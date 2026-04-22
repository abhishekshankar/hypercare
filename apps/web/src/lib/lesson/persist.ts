import "server-only";
import { and, eq } from "drizzle-orm";
import {
  createDbClient,
  lessonProgress,
  lessonReviewSchedule,
  modules,
} from "@hypercare/db";
import {
  dueAtToApproximateLabel,
  scheduleOnLessonComplete,
  scheduleOnLessonStart,
} from "@hypercare/picker";

import { serverEnv } from "@/lib/env.server";
import type { LessonSource } from "./source";
export type { LessonSource } from "./source";
export { parseLessonSource } from "./source";

async function upsertScheduleOnStart(db: ReturnType<typeof createDbClient>, args: {
  userId: string;
  moduleId: string;
  now: Date;
}): Promise<void> {
  const row = scheduleOnLessonStart(args.now);
  try {
    await db
      .insert(lessonReviewSchedule)
      .values({
        userId: args.userId,
        moduleId: args.moduleId,
        bucket: row.bucket,
        dueAt: row.dueAt,
        lastSeenAt: row.lastSeenAt,
        lastOutcome: row.lastOutcome,
        updatedAt: args.now,
      })
      .onConflictDoUpdate({
        target: [lessonReviewSchedule.userId, lessonReviewSchedule.moduleId],
        set: {
          lastSeenAt: args.now,
          updatedAt: args.now,
        },
      });
  } catch (e) {
    console.error("lesson_review_schedule upsert on start failed", e);
  }
}

async function upsertScheduleOnComplete(db: ReturnType<typeof createDbClient>, args: {
  userId: string;
  moduleId: string;
  revisit: boolean;
  now: Date;
}): Promise<{ revisitAck?: string }> {
  try {
    const [existing] = await db
      .select({
        bucket: lessonReviewSchedule.bucket,
      })
      .from(lessonReviewSchedule)
      .where(
        and(
          eq(lessonReviewSchedule.userId, args.userId),
          eq(lessonReviewSchedule.moduleId, args.moduleId),
        ),
      )
      .limit(1);

    const next = scheduleOnLessonComplete(
      existing != null ? { bucket: existing.bucket } : null,
      args.revisit,
      args.now,
    );

    await db
      .insert(lessonReviewSchedule)
      .values({
        userId: args.userId,
        moduleId: args.moduleId,
        bucket: next.bucket,
        dueAt: next.dueAt,
        lastSeenAt: next.lastSeenAt,
        lastOutcome: next.lastOutcome,
        updatedAt: args.now,
      })
      .onConflictDoUpdate({
        target: [lessonReviewSchedule.userId, lessonReviewSchedule.moduleId],
        set: {
          bucket: next.bucket,
          dueAt: next.dueAt,
          lastSeenAt: next.lastSeenAt,
          lastOutcome: next.lastOutcome,
          updatedAt: args.now,
        },
      });

    if (args.revisit) {
      return {
        revisitAck: `Got it — we'll bring this back around in ${dueAtToApproximateLabel(next.dueAt, args.now)}.`,
      };
    }
  } catch (e) {
    console.error("lesson_review_schedule upsert on complete failed", e);
  }
  return {};
}

export async function startLessonProgress(args: {
  userId: string;
  moduleSlug: string;
  source: LessonSource;
}): Promise<{ progressId: string } | "not_found"> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const now = new Date();
  const [m] = await db.select({ id: modules.id }).from(modules).where(eq(modules.slug, args.moduleSlug)).limit(1);
  if (!m) {
    return "not_found";
  }
  const [row] = await db
    .insert(lessonProgress)
    .values({
      userId: args.userId,
      moduleId: m.id,
      source: args.source,
    })
    .returning({ id: lessonProgress.id });
  if (!row) {
    return "not_found";
  }
  await upsertScheduleOnStart(db, { userId: args.userId, moduleId: m.id, now });
  return { progressId: row.id };
}

export type CompleteLessonResult =
  | { status: "not_found" }
  | { status: "ok" }
  | { status: "ok"; revisitAck: string };

export async function completeLessonProgress(args: {
  userId: string;
  progressId: string;
  revisit: boolean;
}): Promise<CompleteLessonResult> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const now = new Date();
  const [updated] = await db
    .update(lessonProgress)
    .set({ completedAt: now, revisit: args.revisit })
    .where(
      and(eq(lessonProgress.id, args.progressId), eq(lessonProgress.userId, args.userId)),
    )
    .returning({ id: lessonProgress.id, moduleId: lessonProgress.moduleId });
  if (!updated) {
    return { status: "not_found" };
  }
  const extra = await upsertScheduleOnComplete(db, {
    userId: args.userId,
    moduleId: updated.moduleId,
    revisit: args.revisit,
    now,
  });
  if (extra.revisitAck != null) {
    return { status: "ok", revisitAck: extra.revisitAck };
  }
  return { status: "ok" };
}
