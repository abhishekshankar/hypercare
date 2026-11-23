import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";

import {
  careProfile,
  createDbClient,
  getCareProfileForUser,
  messages,
  modules,
  safetyFlags,
  userFeedback,
  users,
  weeklyCheckins,
} from "@alongside/db";
import type { Citation, RefusalReason } from "@alongside/rag";

import { serverEnv } from "@/lib/env.server";

export type FeedbackDetailPayload = {
  feedback: {
    id: string;
    kind: string;
    body: string | null;
    triage_state: string;
    triage_priority: string;
    include_context: boolean;
    submitted_at: string;
    resolution_note: string | null;
    linked_module_id: string | null;
    linked_task_id: string | null;
    triaged_at: string | null;
    safety_relabel: string | null;
  };
  user_label: string;
  care: {
    inferred_stage: string | null;
  } | null;
  weekly: { what_helped: string | null; tried_something: boolean | null; answered_at: string | null } | null;
  message: null | {
    id: string;
    content: string;
    citations: Citation[];
    refusal: RefusalReason | null;
    response_kind: string | null;
    created_at: string;
  };
  conversation_excerpt:
    | {
        id: string;
        messages: Array<{
          id: string;
          role: string;
          content: string;
          created_at: string;
        }>;
      }
    | undefined;
  safety_flags: Array<{
    id: string;
    category: string;
    severity: string;
    created_at: string;
  }>;
  linked_module: null | { id: string; slug: string; title: string };
};

function anon(dn: string | null, uid: string) {
  const d = dn?.trim();
  if (d && d.length > 0) {
    if (d.length === 1) return `${d}•`;
    return `${d[0] ?? "?"}•••${d[d.length - 1] ?? ""}`;
  }
  return `Member ${uid.replace(/-/g, "").slice(0, 8)}`;
}

export async function loadFeedbackDetail(id: string): Promise<FeedbackDetailPayload | null> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [fb] = await db.select().from(userFeedback).where(eq(userFeedback.id, id)).limit(1);
  if (!fb) return null;

  const [u] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, fb.userId)).limit(1);

  let inferredStage: string | null = null;
  try {
    const bundle = await getCareProfileForUser(db, fb.userId);
    if (bundle != null) {
      inferredStage = bundle.profile.inferredStage;
    } else {
      const [cp] = await db
        .select({ inferredStage: careProfile.inferredStage })
        .from(careProfile)
        .where(eq(careProfile.userId, fb.userId))
        .limit(1);
      inferredStage = cp?.inferredStage ?? null;
    }
  } catch {
    const [cp] = await db
      .select({ inferredStage: careProfile.inferredStage })
      .from(careProfile)
      .where(eq(careProfile.userId, fb.userId))
      .limit(1);
    inferredStage = cp?.inferredStage ?? null;
  }

  const [wc] = await db
    .select({
      whatHelped: weeklyCheckins.whatHelped,
      triedSomething: weeklyCheckins.triedSomething,
      answeredAt: weeklyCheckins.answeredAt,
    })
    .from(weeklyCheckins)
    .where(eq(weeklyCheckins.userId, fb.userId))
    .orderBy(desc(weeklyCheckins.promptedAt))
    .limit(1);

  let message: FeedbackDetailPayload["message"] = null;
  let excerpt: FeedbackDetailPayload["conversation_excerpt"];

  if (fb.messageId) {
    const [m] = await db
      .select({
        id: messages.id,
        content: messages.content,
        citations: messages.citations,
        refusal: messages.refusal,
        responseKind: messages.responseKind,
        createdAt: messages.createdAt,
        conversationId: messages.conversationId,
      })
      .from(messages)
      .where(eq(messages.id, fb.messageId))
      .limit(1);
    if (m) {
      message = {
        id: m.id,
        content: m.content,
        citations: (m.citations ?? []) as Citation[],
        refusal: (m.refusal ?? null) as RefusalReason | null,
        response_kind: m.responseKind,
        created_at: m.createdAt.toISOString(),
      };
      if (fb.includeContext || fb.kind === "thumbs_down") {
        const convRows = await db
          .select({
            id: messages.id,
            role: messages.role,
            content: messages.content,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.conversationId, m.conversationId))
          .orderBy(asc(messages.createdAt))
          .limit(80);
        excerpt = {
          id: m.conversationId,
          messages: convRows.map((r) => ({
            id: r.id,
            role: r.role,
            content: r.content,
            created_at: r.createdAt.toISOString(),
          })),
        };
      }
    }
  } else if (fb.conversationId && fb.includeContext) {
    const convRows = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, fb.conversationId))
      .orderBy(asc(messages.createdAt))
      .limit(80);
    excerpt = {
      id: fb.conversationId,
      messages: convRows.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        created_at: r.createdAt.toISOString(),
      })),
    };
  }

  const flags = fb.conversationId
    ? await db
        .select({
          id: safetyFlags.id,
          category: safetyFlags.category,
          severity: safetyFlags.severity,
          createdAt: safetyFlags.createdAt,
        })
        .from(safetyFlags)
        .where(
          and(eq(safetyFlags.userId, fb.userId), eq(safetyFlags.conversationId, fb.conversationId)),
        )
        .orderBy(desc(safetyFlags.createdAt))
        .limit(20)
    : [];

  let linkedModule: FeedbackDetailPayload["linked_module"] = null;
  if (fb.linkedModuleId) {
    const [mod] = await db
      .select({ id: modules.id, slug: modules.slug, title: modules.title })
      .from(modules)
      .where(eq(modules.id, fb.linkedModuleId))
      .limit(1);
    if (mod) {
      linkedModule = mod;
    }
  }

  return {
    feedback: {
      id: fb.id,
      kind: fb.kind,
      body: fb.body,
      triage_state: fb.triageState,
      triage_priority: fb.triagePriority,
      include_context: fb.includeContext,
      submitted_at: fb.submittedAt.toISOString(),
      resolution_note: fb.resolutionNote,
      linked_module_id: fb.linkedModuleId,
      linked_task_id: fb.linkedTaskId,
      triaged_at: fb.triagedAt?.toISOString() ?? null,
      safety_relabel: fb.safetyRelabel ?? null,
    },
    user_label: anon(u?.displayName ?? null, fb.userId),
    care: inferredStage != null ? { inferred_stage: inferredStage } : null,
    weekly: wc
      ? {
          what_helped: wc.whatHelped,
          tried_something: wc.triedSomething,
          answered_at: wc.answeredAt?.toISOString() ?? null,
        }
      : null,
    message,
    conversation_excerpt: excerpt,
    safety_flags: flags.map((f) => ({
      id: f.id,
      category: f.category,
      severity: f.severity,
      created_at: f.createdAt.toISOString(),
    })),
    linked_module: linkedModule,
  };
}
