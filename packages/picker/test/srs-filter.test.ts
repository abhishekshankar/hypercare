import { describe, expect, it } from "vitest";

import { applySrsPrefilterToModules, pickSrsFallbackModuleIds, srsDueState, type SrsScheduleRow } from "../src/srs.js";

const now = new Date("2026-04-22T12:00:00.000Z");

function row(partial: Partial<SrsScheduleRow> & Pick<SrsScheduleRow, "dueAt">): SrsScheduleRow {
  return {
    bucket: partial.bucket ?? 0,
    dueAt: partial.dueAt,
    lastSeenAt: partial.lastSeenAt ?? now,
    lastOutcome: partial.lastOutcome ?? "completed",
  };
}

describe("srsDueState", () => {
  it("never_seen when no row", () => {
    expect(srsDueState(undefined, now)).toBe("never_seen");
  });

  it("due when due_at in the past", () => {
    expect(srsDueState(row({ dueAt: new Date(now.getTime() - 86400000) }), now)).toBe("due");
  });

  it("not_yet_due when due_at in the future", () => {
    expect(srsDueState(row({ dueAt: new Date(now.getTime() + 86400000) }), now)).toBe("not_yet_due");
  });
});

describe("applySrsPrefilterToModules", () => {
  const mods = [
    { id: "a", slug: "a", title: "A", createdAt: now, stageRelevance: [] as string[], topicSlugs: [] },
    { id: "b", slug: "b", title: "B", createdAt: now, stageRelevance: [] as string[], topicSlugs: [] },
  ];

  it("keeps all modules when none have schedule rows", () => {
    const out = applySrsPrefilterToModules(mods, new Map(), now);
    expect(out.map((m) => m.id).sort()).toEqual(["a", "b"]);
  });

  it("filters out not_yet_due modules", () => {
    const m = new Map<string, SrsScheduleRow>([
      ["a", row({ dueAt: new Date(now.getTime() + 5 * 86400000) })],
      ["b", row({ dueAt: new Date(now.getTime() - 86400000) })],
    ]);
    const out = applySrsPrefilterToModules(mods, m, now);
    expect(out.map((x) => x.id)).toEqual(["b"]);
  });

  it("when all not_yet_due, falls back to earliest due_at", () => {
    const m = new Map<string, SrsScheduleRow>([
      ["a", row({ dueAt: new Date(now.getTime() + 3 * 86400000) })],
      ["b", row({ dueAt: new Date(now.getTime() + 2 * 86400000) })],
    ]);
    const out = applySrsPrefilterToModules(mods, m, now);
    expect(out.map((x) => x.id)).toEqual(["b"]);
  });
});

describe("pickSrsFallbackModuleIds", () => {
  it("returns all ids when no schedule rows exist", () => {
    const ids = pickSrsFallbackModuleIds(["x", "y"], new Map());
    expect(ids.sort()).toEqual(["x", "y"]);
  });
});
