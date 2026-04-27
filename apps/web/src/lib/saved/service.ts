import "server-only";
import { and, eq, sql, type SQL } from "drizzle-orm";

import {
  conversations,
  createDbClient,
  messages,
  savedAnswers,
} from "@alongside/db";
import type { RefusalReason } from "@alongside/rag";

import { serverEnv } from "@/lib/env.server";

import { encodeSaveListCursor, type SaveListCursor } from "./cursor";
import { buildAssistantPreview } from "./preview";
import { escapeIlikeForContains } from "./escape-ilike";
import { moduleSlugsFromCitations } from "./citations-to-slugs";
import type { SavedItem } from "./types";

const NOTE_MAX = 240;
const IS_POSTGRES_UNIQUE_VIOLATION = "23505";

function db() {
  return createDbClient(serverEnv.DATABASE_URL);
}

function isSafetyTriageRefusal(refusal: unknown): boolean {
  if (!refusal || typeof refusal !== "object") return false;
  return (refusal as RefusalReason).code === "safety_triaged";
}

export class SaveNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaveNotAllowedError";
  }
}

export class MessageNotFoundError extends Error {
  constructor() {
    super("message_not_found");
    this.name = "MessageNotFoundError";
  }
}

export type CreateSaveResult = { kind: "created"; id: string } | { kind: "duplicate"; id: string };

export async function createSavedAnswer(input: {
  userId: string;
  messageId: string;
  note: string | null;
}): Promise<CreateSaveResult> {
  const client = db();
  const [row] = await client
    .select({
      id: messages.id,
      role: messages.role,
      refusal: messages.refusal,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(messages.id, input.messageId),
        eq(conversations.userId, input.userId),
        eq(messages.role, "assistant"),
      ),
    )
    .limit(1);
  if (!row) {
    throw new MessageNotFoundError();
  }
  if (isSafetyTriageRefusal(row.refusal)) {
    throw new SaveNotAllowedError("safety_triaged_cannot_save");
  }

  const note =
    input.note != null && input.note.trim() !== "" ? input.note.trim().slice(0, NOTE_MAX) : null;

  const existing = await client
    .select({ id: savedAnswers.id })
    .from(savedAnswers)
    .where(
      and(eq(savedAnswers.userId, input.userId), eq(savedAnswers.messageId, input.messageId)),
    )
    .limit(1);
  if (existing[0]) {
    return { kind: "duplicate", id: existing[0].id };
  }

  try {
    const [ins] = await client
      .insert(savedAnswers)
      .values({
        userId: input.userId,
        messageId: input.messageId,
        note,
      })
      .returning({ id: savedAnswers.id });
    if (!ins) throw new Error("insert failed");
    return { kind: "created", id: ins.id };
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === IS_POSTGRES_UNIQUE_VIOLATION) {
      const [again] = await client
        .select({ id: savedAnswers.id })
        .from(savedAnswers)
        .where(
          and(
            eq(savedAnswers.userId, input.userId),
            eq(savedAnswers.messageId, input.messageId),
          ),
        )
        .limit(1);
      if (again) return { kind: "duplicate", id: again.id };
    }
    throw e;
  }
}

export async function updateSavedNote(input: { userId: string; saveId: string; note: string | null }) {
  const text =
    input.note != null && input.note.trim() !== "" ? input.note.trim().slice(0, NOTE_MAX) : null;
  const client = db();
  const [u] = await client
    .update(savedAnswers)
    .set({ note: text })
    .where(and(eq(savedAnswers.id, input.saveId), eq(savedAnswers.userId, input.userId)))
    .returning({ id: savedAnswers.id });
  return u ?? null;
}

export async function deleteSavedAnswer(input: { userId: string; saveId: string }): Promise<boolean> {
  const client = db();
  const [del] = await client
    .delete(savedAnswers)
    .where(and(eq(savedAnswers.id, input.saveId), eq(savedAnswers.userId, input.userId)))
    .returning({ id: savedAnswers.id });
  return Boolean(del);
}

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function rowToSavedItem(
  r: {
    id: string;
    message_id: string;
    note: string | null;
    saved_at: Date | string;
    assistant_content: string;
    citations: unknown;
    conversation_id: string;
    conversation_title: string | null;
    question_text: string | null;
  },
  previewLen: number,
): SavedItem {
  return {
    id: r.id,
    message_id: r.message_id,
    conversation_id: r.conversation_id,
    saved_at: toIso(r.saved_at),
    ...(r.note != null && r.note.length > 0 ? { note: r.note } : {}),
    assistant_text_preview: buildAssistantPreview(r.assistant_content, previewLen),
    question_text: (r.question_text ?? "").trim() || "…",
    module_slugs: moduleSlugsFromCitations(r.citations),
    conversation_title: r.conversation_title,
  };
}

type RawListRow = {
  id: string;
  message_id: string;
  note: string | null;
  saved_at: Date | string;
  assistant_content: string;
  citations: unknown;
  conversation_id: string;
  conversation_title: string | null;
  question_text: string | null;
};

function searchCondition(pattern: string): SQL {
  return sql`(
    am.content ILIKE ${pattern} ESCAPE ${"\\"}
    OR COALESCE(sa.note, '') ILIKE ${pattern} ESCAPE ${"\\"}
    OR EXISTS (
      SELECT 1 FROM ${messages} um2
      WHERE um2.conversation_id = c.id
        AND um2.role = 'user'
        AND um2.created_at < am.created_at
        AND um2.content ILIKE ${pattern} ESCAPE ${"\\"}
    )
  )`;
}

export async function listSavedAnswers(input: {
  userId: string;
  q?: string | null;
  limit: number;
  cursor?: SaveListCursor | null;
}): Promise<{ items: SavedItem[]; nextCursor: string | null }> {
  const take = Math.min(Math.max(1, input.limit), 50);
  const client = db();
  const q = input.q?.trim() || "";
  const pattern = q ? `%${escapeIlikeForContains(q)}%` : null;

  const whereExtra: SQL[] = [];
  if (pattern) {
    whereExtra.push(searchCondition(pattern));
  }
  if (input.cursor) {
    const cursor = input.cursor;
    whereExtra.push(
      sql`(sa.saved_at, sa.id) < (${cursor.savedAt}::timestamptz, ${cursor.id}::uuid)`,
    );
  }

  const whereSql =
    whereExtra.length > 0
      ? sql`AND ${sql.join(whereExtra, sql` AND `)}`
      : sql``;

  const res = (await client.execute(
    sql`SELECT
      sa.id,
      sa.message_id,
      sa.note,
      sa.saved_at,
      am.content AS assistant_content,
      am.citations,
      c.id AS conversation_id,
      c.title AS conversation_title,
      uq.text AS question_text
    FROM ${savedAnswers} sa
    INNER JOIN ${messages} am ON am.id = sa.message_id
    INNER JOIN ${conversations} c ON c.id = am.conversation_id
    LEFT JOIN LATERAL (
      SELECT um.content AS text
      FROM ${messages} um
      WHERE um.conversation_id = c.id
        AND um.role = 'user'
        AND um.created_at < am.created_at
      ORDER BY um.created_at DESC
      LIMIT 1
    ) uq ON true
    WHERE sa.user_id = ${input.userId}
    ${whereSql}
    ORDER BY sa.saved_at DESC, sa.id DESC
    LIMIT ${take + 1}`,
  )) as unknown as RawListRow[];

  const rows = res;
  const hasMore = rows.length > take;
  const page = (hasMore ? rows.slice(0, take) : rows) as RawListRow[];
  const items = page.map((r) => rowToSavedItem(r, 280));
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeSaveListCursor({
          id: last.id,
          savedAt:
            last.saved_at instanceof Date
              ? last.saved_at.toISOString()
              : String(last.saved_at),
        })
      : null;
  return {
    items,
    nextCursor,
  };
}

export type HomeSaveTeaser = {
  id: string;
  message_id: string;
  conversation_id: string;
  saved_at: string;
  question_text: string;
  teaser: string;
  note?: string;
  relative_label: string;
  conversation_line: string;
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export async function listRecentSavesForHome(
  userId: string,
  take: number,
): Promise<HomeSaveTeaser[]> {
  const { items } = await listSavedAnswers({ userId, limit: take, cursor: null });
  return items.map((it) => {
    const hasNote = Boolean(it.note && it.note.trim().length > 0);
    const teaser = hasNote && it.note
      ? buildAssistantPreview(it.note, 120)
      : it.assistant_text_preview.length <= 120
        ? it.assistant_text_preview
        : it.assistant_text_preview.slice(0, 120).trimEnd() + "…";
    return {
      id: it.id,
      message_id: it.message_id,
      conversation_id: it.conversation_id,
      saved_at: it.saved_at,
      question_text: it.question_text,
      teaser,
      ...(hasNote && it.note ? { note: it.note } : {}),
      relative_label: relativeTime(it.saved_at),
      conversation_line: it.conversation_title?.trim()
        ? it.conversation_title
        : it.question_text
          ? it.question_text.slice(0, 60) + (it.question_text.length > 60 ? "…" : "")
          : "Conversation",
    };
  });
}

export type ConversationSaveState = { saveId: string; messageId: string; note: string | null };

export async function loadSavesInConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationSaveState[]> {
  const client = db();
  return client
    .select({
      saveId: savedAnswers.id,
      messageId: savedAnswers.messageId,
      note: savedAnswers.note,
    })
    .from(savedAnswers)
    .innerJoin(messages, eq(savedAnswers.messageId, messages.id))
    .where(
      and(eq(savedAnswers.userId, userId), eq(messages.conversationId, conversationId)),
    );
}

