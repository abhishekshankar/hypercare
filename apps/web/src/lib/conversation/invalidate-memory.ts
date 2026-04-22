import "server-only";
import { eq } from "drizzle-orm";
import { conversationMemory, createDbClient } from "@hypercare/db";

import { serverEnv } from "@/lib/env.server";

/** Mark all conversation memory rows for this user stale after a profile change-log write (TASK-027). */
export async function invalidateConversationMemoryForUser(userId: string): Promise<void> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  await db.update(conversationMemory).set({ invalidated: true }).where(eq(conversationMemory.userId, userId));
}
