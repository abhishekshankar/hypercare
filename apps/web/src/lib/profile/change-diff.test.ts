import { describe, expect, it } from "vitest";

import { diffScalarFields, diffStageAnswerKeys, deepEqual } from "./change-diff";
import { STAGE_ANSWER_KEYS } from "@/lib/onboarding/stage-keys";

describe("deepEqual", () => {
  it("treats null and undefined as equal", () => {
    expect(deepEqual(null, undefined)).toBe(true);
  });
  it("compares objects key order independently", () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });
});

describe("diffScalarFields", () => {
  it("emits one row per changed field", () => {
    const d = diffScalarFields(
      "about_you",
      { hardest_thing: "sleep" },
      { hardest_thing: "guilt" },
    );
    expect(d).toEqual([
      {
        section: "about_you",
        field: "hardest_thing",
        oldValue: "sleep",
        newValue: "guilt",
      },
    ]);
  });
  it("emits no rows when equal", () => {
    const d = diffScalarFields("living", { living_situation: "alone" }, { living_situation: "alone" });
    expect(d).toHaveLength(0);
  });
});

describe("diffStageAnswerKeys", () => {
  it("diffs per stage key", () => {
    const before: Record<string, unknown> = Object.fromEntries(
      STAGE_ANSWER_KEYS.map((k) => [k, "yes"]),
    );
    const after: Record<string, unknown> = { ...before, bathes_alone: "no" };
    const d = diffStageAnswerKeys(before, after);
    expect(d).toEqual([
      {
        section: "stage",
        field: "bathes_alone",
        oldValue: "yes",
        newValue: "no",
      },
    ]);
  });
  it("empty when no key changes", () => {
    const o: Record<string, unknown> = Object.fromEntries(
      STAGE_ANSWER_KEYS.map((k) => [k, "yes"]),
    );
    expect(diffStageAnswerKeys(o, { ...o })).toHaveLength(0);
  });
});
