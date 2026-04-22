import "server-only";
import { and, eq } from "drizzle-orm";

import { conversations, createDbClient, messages } from "@hypercare/db";
import type { AnswerResult, Citation, RefusalReason } from "@hypercare/rag";

import { serverEnv } from "@/lib/env.server";

export type CreateConversationInput = {
  userId: string;
  title?: string | null;
};

export async function createConversation(
  input: CreateConversationInput,
): Promise<{ id: string }> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db
    .insert(conversations)
    .values({
      userId: input.userId,
      title: input.title ?? null,
    })
    .returning({ id: conversations.id });
  if (!row) {
    throw new Error("Failed to create conversation row.");
  }
  return { id: row.id };
}

/** Load a conversation owned by `userId`, or return null. */
export async function loadConversationOwned(
  conversationId: string,
  userId: string,
): Promise<{ id: string; title: string | null } | null> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db
    .select({ id: conversations.id, title: conversations.title })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  return row ?? null;
}

export type AssistantMessageRow = {
  id: string;
  role: "assistant";
  content: string;
  citations: Citation[];
  refusal: RefusalReason | null;
  createdAt: Date;
};

export type UserMessageRow = {
  id: string;
  role: "user";
  content: string;
  createdAt: Date;
};

export type PersistedTurn = {
  user: UserMessageRow;
  assistant: AssistantMessageRow;
};

/**
 * Persist one user→assistant turn from a `rag.answer()` call.
 *
 * Writes happen in declaration order — user row first so the assistant row
 * (and any safety_flag inserted by the safety package at layer 0) point at
 * a real conversation_id even if the assistant insert fails.
 */
export async function persistTurn(args: {
  conversationId: string;
  userText: string;
  result: AnswerResult;
}): Promise<PersistedTurn> {
  const db = createDbClient(serverEnv.DATABASE_URL);

  const [userRow] = await db
    .insert(messages)
    .values({
      conversationId: args.conversationId,
      role: "user",
      content: args.userText,
    })
    .returning({
      id: messages.id,
      content: messages.content,
      createdAt: messages.createdAt,
    });
  if (!userRow) {
    throw new Error("Failed to insert user message.");
  }

  const assistantContent =
    args.result.kind === "answered" ? args.result.text : "";
  const assistantCitations: Citation[] =
    args.result.kind === "answered" ? args.result.citations : [];
  const assistantRefusal: RefusalReason | null =
    args.result.kind === "refused" ? args.result.reason : null;
  const responseKind: "answer" | "refusal" =
    args.result.kind === "answered" ? "answer" : "refusal";

  const [assistantRow] = await db
    .insert(messages)
    .values({
      conversationId: args.conversationId,
      role: "assistant",
      content: assistantContent,
      responseKind,
      citations: assistantCitations,
      refusal: assistantRefusal,
    })
    .returning({
      id: messages.id,
      content: messages.content,
      citations: messages.citations,
      refusal: messages.refusal,
      createdAt: messages.createdAt,
    });
  if (!assistantRow) {
    throw new Error("Failed to insert assistant message.");
  }

  // bump conversations.updated_at so "recent conversations" sorts correctly.
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, args.conversationId));

  return {
    user: {
      id: userRow.id,
      role: "user",
      content: userRow.content,
      createdAt: userRow.createdAt,
    },
    assistant: {
      id: assistantRow.id,
      role: "assistant",
      content: assistantRow.content,
      citations: (assistantRow.citations ?? []) as Citation[],
      refusal: (assistantRow.refusal ?? null) as RefusalReason | null,
      createdAt: assistantRow.createdAt,
    },
  };
}
