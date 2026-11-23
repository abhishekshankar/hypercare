import { createDbClient, safetyFlags, userSuppression } from "@alongside/db";
import { desc, eq } from "drizzle-orm";

import type { RetrievedChunk } from "@alongside/rag";

export async function getUserSuppressionExists(
  databaseUrl: string,
  userId: string,
): Promise<boolean> {
  const db = createDbClient(databaseUrl);
  const [row] = await db
    .select({ id: userSuppression.userId })
    .from(userSuppression)
    .where(eq(userSuppression.userId, userId))
    .limit(1);
  return row !== undefined;
}

export async function getLatestSafetyFlagCategory(
  databaseUrl: string,
  userId: string,
): Promise<string | null> {
  const db = createDbClient(databaseUrl);
  const [row] = await db
    .select({ category: safetyFlags.category })
    .from(safetyFlags)
    .where(eq(safetyFlags.userId, userId))
    .orderBy(desc(safetyFlags.createdAt))
    .limit(1);
  return row?.category ?? null;
}

/** True if any of the first `k` retrieval hits have `moduleTier === 1` (RAG v2). */
export function topKHitsHasTier1(hits: RetrievedChunk[], k: number): boolean {
  const take = Math.min(k, hits.length);
  for (let i = 0; i < take; i++) {
    if (hits[i]!.moduleTier === 1) return true;
  }
  return false;
}
