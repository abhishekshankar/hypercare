import "server-only";
import { eq, inArray } from "drizzle-orm";
import { conversationMemory, createDbClient } from "@alongside/db";

import { serverEnv } from "@/lib/env.server";

/** Mark all conversation memory rows for this user stale after a profile change-log write (TASK-027). */
export async function invalidateConversationMemoryForUser(userId: string): Promise<void> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  await db.update(conversationMemory).set({ invalidated: true }).where(eq(conversationMemory.userId, userId));
}

/** After a shared profile edit, every household caregiver’s memory should refresh (TASK-038). */
export async function invalidateConversationMemoryForUserIds(userIds: string[]): Promise<void> {
  if (userIds.length === 0) {
    return;
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  await db
    .update(conversationMemory)
    .set({ invalidated: true })
    .where(inArray(conversationMemory.userId, userIds));
}
