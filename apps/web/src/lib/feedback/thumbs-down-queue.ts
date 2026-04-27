import "server-only";
import { and, eq } from "drizzle-orm";

import { createDbClient, messages, userFeedback } from "@alongside/db";

/**
 * App-layer hook: when `messages.rating` is set to `down`, inserts `user_feedback`
 * (ADR 0025). Idempotent per assistant message via partial unique index.
 */
export async function recordThumbsDownFeedback(args: {
  databaseUrl: string;
  userId: string;
  messageId: string;
}): Promise<{ inserted: boolean; feedbackId?: string }> {
  const db = createDbClient(args.databaseUrl);
  const [msg] = await db
    .select({
      conversationId: messages.conversationId,
      refusalReasonCode: messages.refusalReasonCode,
    })
    .from(messages)
    .where(and(eq(messages.id, args.messageId), eq(messages.role, "assistant")))
    .limit(1);
  if (!msg) {
    return { inserted: false };
  }

  const high = msg.refusalReasonCode === "safety_triaged";

  const [dup] = await db
    .select({ id: userFeedback.id })
    .from(userFeedback)
    .where(and(eq(userFeedback.messageId, args.messageId), eq(userFeedback.kind, "thumbs_down")))
    .limit(1);
  if (dup) {
    return { inserted: false, feedbackId: dup.id };
  }

  const [row] = await db
    .insert(userFeedback)
    .values({
      userId: args.userId,
      kind: "thumbs_down",
      body: null,
      conversationId: msg.conversationId,
      messageId: args.messageId,
      includeContext: true,
      triagePriority: high ? "high" : "normal",
    })
    .returning({ id: userFeedback.id });

  if (row == null) {
    return { inserted: false };
  }
  return { inserted: true, feedbackId: row.id };
}
