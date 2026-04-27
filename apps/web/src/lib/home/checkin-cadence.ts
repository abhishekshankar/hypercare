import { and, count, desc, eq, gte } from "drizzle-orm";
import { createDbClient, safetyFlags, weeklyCheckins } from "@alongside/db";

const MS_DAY = 24 * 60 * 60 * 1000;

export type CheckinShouldShowReason = "cadence" | "soft_flag_elevation" | null;

export type CheckinCadenceDeps = {
  db: ReturnType<typeof createDbClient>;
  now: () => Date;
};

/**
 * Weekly check-in surface (PRD §3.3, §10.4 elevation). Counts soft burnout self-check
 * signals in the rolling 7-day window.
 */
export async function countSoftFlagsLast7Days(
  userId: string,
  deps: CheckinCadenceDeps,
): Promise<number> {
  const now = deps.now();
  const since = new Date(now.getTime() - 7 * MS_DAY);
  const [row] = await deps.db
    .select({ c: count() })
    .from(safetyFlags)
    .where(
      and(
        eq(safetyFlags.userId, userId),
        gte(safetyFlags.createdAt, since),
        eq(safetyFlags.category, "self_care_burnout"),
      ),
    );
  return Number(row?.c ?? 0);
}

/** Pure policy for tests and implementation (TASK-024). */
export function shouldShowCheckinFromLastPrompt(
  now: Date,
  lastPrompt: Date | null,
  softFlagCount7d: number,
): { show: boolean; reason: CheckinShouldShowReason } {
  if (lastPrompt == null) {
    return { show: true, reason: "cadence" };
  }
  const daysSince = (now.getTime() - lastPrompt.getTime()) / MS_DAY;
  if (daysSince < 3) {
    return { show: false, reason: null };
  }
  if (daysSince >= 3 && daysSince < 7 && softFlagCount7d >= 2) {
    return { show: true, reason: "soft_flag_elevation" };
  }
  if (daysSince >= 7) {
    return { show: true, reason: "cadence" };
  }
  return { show: false, reason: null };
}

/**
 * Returns whether the home check-in card should show and why.
 */
export async function shouldShowWeeklyCheckin(
  userId: string,
  deps: CheckinCadenceDeps,
): Promise<{ show: boolean; reason: CheckinShouldShowReason }> {
  const now = deps.now();

  const [lastRow] = await deps.db
    .select({ promptedAt: weeklyCheckins.promptedAt })
    .from(weeklyCheckins)
    .where(eq(weeklyCheckins.userId, userId))
    .orderBy(desc(weeklyCheckins.promptedAt))
    .limit(1);

  const lastPrompt = lastRow?.promptedAt ?? null;
  const soft = await countSoftFlagsLast7Days(userId, deps);
  return shouldShowCheckinFromLastPrompt(now, lastPrompt, soft);
}
