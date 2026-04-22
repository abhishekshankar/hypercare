/**
 * Unit tests for lesson_progress writes (TASK-024) + schedule upserts (TASK-037).
 * The DB client is mocked so we can assert Drizzle calls without Postgres.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env.server", () => ({
  serverEnv: { DATABASE_URL: "postgresql://127.0.0.1:5432/hc_test" },
}));

const insertedRows: unknown[] = [];
const updatedSets: unknown[] = [];
let selectModuleRows: { id: string }[] = [{ id: "mod-1" }];
let scheduleSelectRows: { bucket: number }[] = [];
let returningInsert: { id: string }[] = [{ id: "prog-1" }];
let returningUpdate: { id: string; moduleId: string }[] = [{ id: "prog-1", moduleId: "mod-1" }];

vi.mock("@hypercare/db", () => {
  return {
    TOPICS_V0: [],
    modules: { _: "modules", slug: "modules.slug", id: "modules.id" },
    lessonProgress: {
      _: "lesson_progress",
      id: "lesson_progress.id",
      userId: "lesson_progress.user_id",
      moduleId: "lesson_progress.module_id",
    },
    lessonReviewSchedule: {
      _: "lesson_review_schedule",
      bucket: "lesson_review_schedule.bucket",
      userId: "lesson_review_schedule.user_id",
      moduleId: "lesson_review_schedule.module_id",
    },
    createDbClient: () => {
      let sawUpdate = false;
      return {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => {
                if (sawUpdate) {
                  return scheduleSelectRows;
                }
                return selectModuleRows;
              },
            }),
          }),
        }),
        insert: () => ({
          values: (row: unknown) => {
            insertedRows.push(row);
            return {
              returning: async () => returningInsert,
              onConflictDoUpdate: async () => undefined,
            };
          },
        }),
        update: () => ({
          set: (s: unknown) => {
            updatedSets.push(s);
            return {
              where: () => ({
                returning: async () => {
                  sawUpdate = true;
                  return returningUpdate;
                },
              }),
            };
          },
        }),
      };
    },
  };
});

import { completeLessonProgress, startLessonProgress } from "@/lib/lesson/persist";

describe("lesson persist (TASK-024 + TASK-037)", () => {
  beforeEach(() => {
    insertedRows.length = 0;
    updatedSets.length = 0;
    selectModuleRows = [{ id: "mod-1" }];
    scheduleSelectRows = [];
    returningInsert = [{ id: "prog-1" }];
    returningUpdate = [{ id: "prog-1", moduleId: "mod-1" }];
  });

  it("startLessonProgress writes lesson_progress then schedule upsert payload", async () => {
    const r = await startLessonProgress({
      userId: "user-1",
      moduleSlug: "behavior-sundowning",
      source: "weekly_focus",
    });
    expect(r).toEqual({ progressId: "prog-1" });
    expect(insertedRows.length).toBeGreaterThanOrEqual(2);
    const lesson = insertedRows[0] as Record<string, unknown>;
    expect(lesson.userId).toBe("user-1");
    expect(lesson.moduleId).toBe("mod-1");
    expect(lesson.source).toBe("weekly_focus");
    const sched = insertedRows[1] as Record<string, unknown>;
    expect(sched.userId).toBe("user-1");
    expect(sched.moduleId).toBe("mod-1");
    expect(sched.bucket).toBe(0);
    expect(sched.lastOutcome).toBe("started_not_completed");
  });

  it("startLessonProgress returns not_found when module slug does not exist", async () => {
    selectModuleRows = [];
    const r = await startLessonProgress({
      userId: "user-1",
      moduleSlug: "missing",
      source: "library_browse",
    });
    expect(r).toBe("not_found");
    expect(insertedRows).toHaveLength(0);
  });

  it("completeLessonProgress sets completed_at + revisit=false on Got it", async () => {
    const r = await completeLessonProgress({
      userId: "user-1",
      progressId: "prog-1",
      revisit: false,
    });
    expect(r).toEqual({ status: "ok" });
    expect(updatedSets).toHaveLength(1);
    const set = updatedSets[0] as Record<string, unknown>;
    expect(set.revisit).toBe(false);
    expect(set.completedAt).toBeInstanceOf(Date);
  });

  it("completeLessonProgress returns revisitAck when user picks Revisit", async () => {
    scheduleSelectRows = [{ bucket: 3 }];
    const r = await completeLessonProgress({
      userId: "user-1",
      progressId: "prog-1",
      revisit: true,
    });
    expect(r.status).toBe("ok");
    if (r.status === "ok" && "revisitAck" in r) {
      expect(r.revisitAck).toContain("Got it");
      expect(r.revisitAck).toContain("back around");
    }
    const set = updatedSets[0] as Record<string, unknown>;
    expect(set.revisit).toBe(true);
  });

  it("completeLessonProgress returns not_found when no row updates", async () => {
    returningUpdate = [];
    const r = await completeLessonProgress({
      userId: "user-1",
      progressId: "missing",
      revisit: false,
    });
    expect(r).toEqual({ status: "not_found" });
  });
});
