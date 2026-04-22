/**
 * Unit tests for lesson_progress writes (TASK-024). The DB client is mocked so we
 * can assert the values handed to Drizzle without a live Postgres.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env.server", () => ({
  serverEnv: { DATABASE_URL: "postgresql://127.0.0.1:5432/hc_test" },
}));

const insertedRows: unknown[] = [];
const updatedSets: unknown[] = [];
let selectModuleRows: { id: string }[] = [{ id: "mod-1" }];
let returningInsert: { id: string }[] = [{ id: "prog-1" }];
let returningUpdate: { id: string }[] = [{ id: "prog-1" }];

vi.mock("@hypercare/db", () => {
  return {
    modules: { _: "modules", slug: "modules.slug", id: "modules.id" },
    lessonProgress: {
      _: "lesson_progress",
      id: "lesson_progress.id",
      userId: "lesson_progress.user_id",
    },
    createDbClient: () => ({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => selectModuleRows,
          }),
        }),
      }),
      insert: () => ({
        values: (row: unknown) => ({
          returning: async () => {
            insertedRows.push(row);
            return returningInsert;
          },
        }),
      }),
      update: () => ({
        set: (s: unknown) => {
          updatedSets.push(s);
          return {
            where: () => ({
              returning: async () => returningUpdate,
            }),
          };
        },
      }),
    }),
  };
});

import { completeLessonProgress, startLessonProgress } from "@/lib/lesson/persist";

describe("lesson persist (TASK-024)", () => {
  beforeEach(() => {
    insertedRows.length = 0;
    updatedSets.length = 0;
    selectModuleRows = [{ id: "mod-1" }];
    returningInsert = [{ id: "prog-1" }];
    returningUpdate = [{ id: "prog-1" }];
  });

  it("startLessonProgress writes a row with userId, moduleId, source (no completed_at)", async () => {
    const r = await startLessonProgress({
      userId: "user-1",
      moduleSlug: "behavior-sundowning",
      source: "weekly_focus",
    });
    expect(r).toEqual({ progressId: "prog-1" });
    expect(insertedRows).toHaveLength(1);
    const row = insertedRows[0] as Record<string, unknown>;
    expect(row.userId).toBe("user-1");
    expect(row.moduleId).toBe("mod-1");
    expect(row.source).toBe("weekly_focus");
    expect("completedAt" in row).toBe(false);
    expect("revisit" in row).toBe(false);
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
    expect(r).toBe("ok");
    expect(updatedSets).toHaveLength(1);
    const set = updatedSets[0] as Record<string, unknown>;
    expect(set.revisit).toBe(false);
    expect(set.completedAt).toBeInstanceOf(Date);
  });

  it("completeLessonProgress sets revisit=true when user picks Revisit", async () => {
    const r = await completeLessonProgress({
      userId: "user-1",
      progressId: "prog-1",
      revisit: true,
    });
    expect(r).toBe("ok");
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
    expect(r).toBe("not_found");
  });
});
