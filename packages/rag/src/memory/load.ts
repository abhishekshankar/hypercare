import { and, eq } from "drizzle-orm";
import { conversationMemory, createDbClient } from "@alongside/db";

import type { ConversationMemoryForPrompt } from "./types.js";
import { parseMemorySections } from "./section-parse.js";

/**
 * Load conversation memory for Layer 4 when it is current (not invalidated).
 * Invalidated or missing row → null.
 */
export async function loadConversationMemoryForAnswer(
  databaseUrl: string,
  conversationId: string,
  userId: string,
): Promise<ConversationMemoryForPrompt | null> {
  const db = createDbClient(databaseUrl);
  const [row] = await db
    .select({
      summaryMd: conversationMemory.summaryMd,
      invalidated: conversationMemory.invalidated,
    })
    .from(conversationMemory)
    .where(
      and(
        eq(conversationMemory.conversationId, conversationId),
        eq(conversationMemory.userId, userId),
        eq(conversationMemory.invalidated, false),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    summaryMd: row.summaryMd,
    sections: parseMemorySections(row.summaryMd),
  };
}
