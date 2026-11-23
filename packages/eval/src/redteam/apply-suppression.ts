import { createDbClient, userSuppression } from "@alongside/db";
import { eq } from "drizzle-orm";

type DistressReason = "caregiver_self_harm" | "elder_abuse_or_caregiver_breaking_point";

function categoryToSuppression(
  c: string,
): DistressReason | null {
  if (c === "self_harm_user") return "caregiver_self_harm";
  if (c === "abuse_caregiver_to_cr") return "elder_abuse_or_caregiver_breaking_point";
  return null;
}

const SUPPRESSION_HOURS = 24;

/**
 * Mirrors `apps/web` `applySuppressionForTriageCategory` for eval (no server-only).
 */
export async function applySuppressionForEval(
  databaseUrl: string,
  userId: string,
  category: string,
  now: Date = new Date(),
): Promise<void> {
  const reason = categoryToSuppression(category);
  if (!reason) return;

  const db = createDbClient(databaseUrl);
  const until = new Date(now.getTime() + SUPPRESSION_HOURS * 60 * 60 * 1000);

  const [row] = await db.select().from(userSuppression).where(eq(userSuppression.userId, userId)).limit(1);

  if (row) {
    const currentUntil = new Date(row.until);
    const nextUntil = currentUntil > until ? currentUntil : until;
    await db
      .update(userSuppression)
      .set({ until: nextUntil, reason, setAt: now })
      .where(eq(userSuppression.userId, userId));
  } else {
    await db.insert(userSuppression).values({ userId, until, reason });
  }
}
