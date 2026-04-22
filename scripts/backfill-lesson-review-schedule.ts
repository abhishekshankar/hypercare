/**
 * Idempotent backfill: one `lesson_review_schedule` row per (user_id, module_id) from
 * latest `lesson_progress` row per pair (TASK-037).
 *
 *   DATABASE_URL=... pnpm exec tsx scripts/backfill-lesson-review-schedule.ts
 */
import { and, desc, eq } from "drizzle-orm";
import { createDbClient, lessonProgress, lessonReviewSchedule } from "@hypercare/db";
import { addDays, intervalDaysForBucket, type SrsLastOutcome } from "@hypercare/picker";

function requireUrl(): string {
  const u = process.env.DATABASE_URL;
  if (u == null || u.length === 0) {
    throw new Error("DATABASE_URL is required");
  }
  return u;
}

function weeksSince(d: Date, now: Date): number {
  return Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

async function main(): Promise<void> {
  const db = createDbClient(requireUrl());
  const now = new Date();

  const keys = await db
    .select({
      userId: lessonProgress.userId,
      moduleId: lessonProgress.moduleId,
    })
    .from(lessonProgress)
    .groupBy(lessonProgress.userId, lessonProgress.moduleId);

  let upserts = 0;
  for (const k of keys) {
    const [r] = await db
      .select()
      .from(lessonProgress)
      .where(and(eq(lessonProgress.userId, k.userId), eq(lessonProgress.moduleId, k.moduleId)))
      .orderBy(desc(lessonProgress.startedAt))
      .limit(1);
    if (!r) {
      continue;
    }
    let bucket = 0;
    let lastOutcome: SrsLastOutcome = "started_not_completed";
    if (r.completedAt != null) {
      lastOutcome = r.revisit ? "revisit_requested" : "completed";
      const w = weeksSince(r.completedAt, now);
      bucket = Math.min(Math.max(w, 0), 5);
      if (r.revisit) {
        bucket = Math.max(bucket - 2, 1);
      }
    } else {
      lastOutcome = "started_not_completed";
      bucket = 0;
    }
    const dueAt =
      r.completedAt != null
        ? addDays(r.completedAt, intervalDaysForBucket(bucket))
        : addDays(r.startedAt, intervalDaysForBucket(0));
    const lastSeenAt = r.completedAt ?? r.startedAt;

    await db
      .insert(lessonReviewSchedule)
      .values({
        userId: r.userId,
        moduleId: r.moduleId,
        bucket,
        dueAt,
        lastSeenAt,
        lastOutcome,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [lessonReviewSchedule.userId, lessonReviewSchedule.moduleId],
        set: {
          bucket,
          dueAt,
          lastSeenAt,
          lastOutcome,
          updatedAt: now,
        },
      });
    upserts += 1;
  }

  console.log(`backfill.lesson_review_schedule rows=${String(upserts)}`);
  process.exit(0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
