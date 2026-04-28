import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";

import { conversations, createDbClient, messages } from "@alongside/db";
import type { Citation, RefusalReason } from "@alongside/rag";

import { serverEnv } from "@/lib/env.server";
import { maybeDecodePercentEncoding } from "@/lib/url/maybe-decode-uri-component";

export type UiMessage =
  | {
      id: string;
      role: "user";
      content: string;
      createdAt: string;
    }
  | {
      id: string;
      role: "assistant";
      content: string;
      citations: Citation[];
      refusal: RefusalReason | null;
      createdAt: string;
      /** TASK-011 / TASK-036: optional helpfulness on eligible assistant rows. */
      rating: "up" | "down" | null;
      ratingInvited: boolean;
    };

export type RecentConversation = {
  id: string;
  title: string | null;
  /** First user message in the conversation, used as a fallback display string. */
  preview: string | null;
  updatedAt: string;
};

/** Load all messages for a conversation owned by `userId`, oldest first. */
export async function loadThread(
  conversationId: string,
  userId: string,
): Promise<{ id: string; title: string | null; messages: UiMessage[] } | null> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [conv] = await db
    .select({ id: conversations.id, title: conversations.title })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  if (!conv) return null;

  const rows = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      citations: messages.citations,
      refusal: messages.refusal,
      createdAt: messages.createdAt,
      rating: messages.rating,
      ratingInvited: messages.ratingInvited,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  const ui: UiMessage[] = rows.map((r) => {
    if (r.role === "assistant") {
      return {
        id: r.id,
        role: "assistant",
        content: r.content,
        citations: (r.citations ?? []) as Citation[],
        refusal: (r.refusal ?? null) as RefusalReason | null,
        createdAt: r.createdAt.toISOString(),
        rating: (r.rating as "up" | "down" | null) ?? null,
        ratingInvited: r.ratingInvited === true,
      };
    }
    return {
      id: r.id,
      role: "user",
      content: maybeDecodePercentEncoding(r.content),
      createdAt: r.createdAt.toISOString(),
    };
  });

  return {
    id: conv.id,
    title: conv.title == null ? null : maybeDecodePercentEncoding(conv.title),
    messages: ui,
  };
}

/**
 * Load up to `limit` most recently-updated conversations for `userId`,
 * each with its first user message as the preview.
 */
export async function loadRecentConversations(
  userId: string,
  limit = 5,
): Promise<RecentConversation[]> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const convRows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
  if (convRows.length === 0) return [];

  // Fetch the first user message per conversation for the preview.
  // N+1 is acceptable at limit=5 for v0; revisit when the home shows >5.
  const previews = await Promise.all(
    convRows.map(async (c) => {
      const [first] = await db
        .select({ content: messages.content })
        .from(messages)
        .where(and(eq(messages.conversationId, c.id), eq(messages.role, "user")))
        .orderBy(asc(messages.createdAt))
        .limit(1);
      return { id: c.id, preview: first?.content ?? null };
    }),
  );
  const previewById = new Map(previews.map((p) => [p.id, p.preview]));

  return convRows.map((c) => {
    const rawPreview = previewById.get(c.id) ?? null;
    return {
      id: c.id,
      title: c.title == null ? null : maybeDecodePercentEncoding(c.title),
      preview: rawPreview == null ? null : maybeDecodePercentEncoding(rawPreview),
      updatedAt: c.updatedAt.toISOString(),
    };
  });
}
