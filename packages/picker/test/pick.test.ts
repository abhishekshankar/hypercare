import { describe, expect, it } from "vitest";

import { pickThisWeeksFocusFromData } from "../src/pick-candidates.js";
import type { PickerModuleRow, ProfileChangeRow } from "../src/pick-candidates.js";

const now = new Date("2026-04-22T12:00:00.000Z");

function mod(
  over: Partial<PickerModuleRow> & Pick<PickerModuleRow, "id" | "slug" | "title">,
): PickerModuleRow {
  return {
    createdAt: new Date("2026-01-01"),
    stageRelevance: ["early", "middle", "late"],
    topicSlugs: [],
    ...over,
  };
}

describe("pickThisWeeksFocusFromData", () => {
  it("empty signal + no profile change → step 3 stage baseline (early module)", () => {
    const mEarly = mod({
      id: "a1",
      slug: "mod-a",
      title: "A",
      createdAt: new Date("2026-01-01"),
      stageRelevance: ["early"],
    });
    const m2 = mod({
      id: "b1",
      slug: "mod-b",
      title: "B",
      createdAt: new Date("2026-01-02"),
      stageRelevance: ["late"],
    });
    const r = pickThisWeeksFocusFromData({
      now,
      recentlyCompletedModuleIds: new Set(),
      publishedModules: [m2, mEarly],
      profileChanges7d: [],
      topTopics: [],
      userStage: "early",
    });
    expect(r).toMatchObject({
      kind: "pick",
      slug: "mod-a",
      rationale: { kind: "stage_baseline", stage: "early" },
    });
  });

  it("recent topic = bathing-resistance and a tagged, uncompleted module → step 2", () => {
    const bath = mod({
      id: "bath",
      slug: "daily-bathing",
      title: "Bathing",
      topicSlugs: ["bathing-resistance"],
    });
    const other = mod({
      id: "o",
      slug: "other",
      title: "O",
      createdAt: new Date("2019-01-01"),
    });
    const r = pickThisWeeksFocusFromData({
      now,
      recentlyCompletedModuleIds: new Set(),
      publishedModules: [other, bath],
      profileChanges7d: [],
      topTopics: [{ slug: "bathing-resistance", weight: 1 }],
      userStage: "middle",
    });
    if (r.kind !== "pick") {
      expect.fail("expected pick");
    }
    expect(r.slug).toBe("daily-bathing");
    expect(r.rationale).toEqual({ kind: "recent_topic", topicSlug: "bathing-resistance" });
  });

  it("same module completed recently → step 2 skips; step 3 may still pick that module if nothing else", () => {
    const bath = mod({
      id: "bath",
      slug: "daily-bathing",
      title: "Bathing",
      topicSlugs: ["bathing-resistance"],
    });
    const sun = mod({
      id: "sun",
      slug: "behavior-sundowning",
      title: "Sundowning",
      topicSlugs: ["sundowning"],
    });
    const r = pickThisWeeksFocusFromData({
      now,
      recentlyCompletedModuleIds: new Set([bath.id]),
      publishedModules: [bath, sun],
      profileChanges7d: [],
      topTopics: [{ slug: "bathing-resistance", weight: 1 }],
      userStage: "middle",
    });
    if (r.kind !== "pick") {
      expect.fail("expected pick");
    }
    expect(r.slug).toBe("behavior-sundowning");
  });

  it("profile change hardest_thing = guilt 2d ago + guilt-tagged module → step 1", () => {
    const guilt = mod({
      id: "g",
      slug: "self-care-caregiver-burnout",
      title: "Burnout",
      topicSlugs: ["guilt-and-grief", "caregiver-burnout"],
    });
    const ch: ProfileChangeRow = {
      field: "hardest_thing",
      section: "what_matters",
      oldValue: "sleep",
      newValue: "guilt and grief are crushing me",
      changedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    };
    const r = pickThisWeeksFocusFromData({
      now,
      recentlyCompletedModuleIds: new Set(),
      publishedModules: [guilt],
      profileChanges7d: [ch],
      topTopics: [],
      userStage: "late",
    });
    if (r.kind !== "pick") {
      expect.fail("expected pick");
    }
    expect(r.slug).toBe("self-care-caregiver-burnout");
    expect(r.rationale.kind).toBe("profile_change");
  });

  it("no published modules → no_pick", () => {
    const r = pickThisWeeksFocusFromData({
      now,
      recentlyCompletedModuleIds: new Set(),
      publishedModules: [],
      profileChanges7d: [],
      topTopics: [],
      userStage: "early",
    });
    expect(r).toEqual({ kind: "no_pick", reason: "no_eligible_modules" });
  });

  it("bathing topic but only other modules share stage, bathing completed → re-pick bathing in step 3 if only candidate", () => {
    const bath = mod({
      id: "bath",
      slug: "daily-bathing",
      title: "Bathing",
      createdAt: new Date("2026-01-01"),
      stageRelevance: ["middle", "late"],
      topicSlugs: ["bathing-resistance"],
    });
    const r = pickThisWeeksFocusFromData({
      now,
      recentlyCompletedModuleIds: new Set([bath.id]),
      publishedModules: [bath],
      profileChanges7d: [],
      topTopics: [],
      userStage: "middle",
    });
    if (r.kind !== "pick") {
      expect.fail("expected pick");
    }
    expect(r.slug).toBe("daily-bathing");
    expect(r.rationale.kind).toBe("stage_baseline");
  });
});
