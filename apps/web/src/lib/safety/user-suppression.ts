import "server-only";

import { userSuppression } from "@alongside/db";
import { createDbClient } from "@alongside/db";
import { eq } from "drizzle-orm";

import { serverEnv } from "@/lib/env.server";

const SUPPRESSION_HOURS = 24;

type DistressReason = "caregiver_self_harm" | "elder_abuse_or_caregiver_breaking_point";

function categoryToSuppression(
  c: "self_harm_user" | "abuse_caregiver_to_cr" | (string & {}),
): DistressReason | null {
  if (c === "self_harm_user") return "caregiver_self_harm";
  if (c === "abuse_caregiver_to_cr") return "elder_abuse_or_caregiver_breaking_point";
  return null;
}

/**
 * 24h home-screen lesson suppression (PRD §10.3) after distress triage.
 */
export async function applySuppressionForTriageCategory(
  userId: string,
  category: string,
  now: Date = new Date(),
): Promise<void> {
  const reason = categoryToSuppression(category);
  if (!reason) return;

  const db = createDbClient(serverEnv.DATABASE_URL);
  const until = new Date(now.getTime() + SUPPRESSION_HOURS * 60 * 60 * 1000);

  const [row] = await db
    .select()
    .from(userSuppression)
    .where(eq(userSuppression.userId, userId))
    .limit(1);

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

export type SuppressionStatus = {
  active: boolean;
  until?: string;
  reason?: string;
};

export async function getSuppressionStatus(
  userId: string,
  now: Date = new Date(),
): Promise<SuppressionStatus> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db
    .select()
    .from(userSuppression)
    .where(eq(userSuppression.userId, userId))
    .limit(1);
  if (!row) return { active: false };
  if (row.until <= now) {
    await db.delete(userSuppression).where(eq(userSuppression.userId, userId));
    return { active: false };
  }
  return {
    active: true,
    until: row.until.toISOString(),
    reason: row.reason,
  };
}
