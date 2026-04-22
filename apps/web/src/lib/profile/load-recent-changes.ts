import "server-only";
import { desc, eq } from "drizzle-orm";
import { careProfileChanges, createDbClient } from "@hypercare/db";

import { serverEnv } from "../env.server";

export type ProfileChangeListRow = typeof careProfileChanges.$inferSelect;

export async function loadRecentProfileChanges(
  userId: string,
  limit: number,
): Promise<ProfileChangeListRow[]> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const rows = await db
    .select()
    .from(careProfileChanges)
    .where(eq(careProfileChanges.userId, userId))
    .orderBy(desc(careProfileChanges.changedAt))
    .limit(limit);
  return rows.slice().reverse();
}
