import { describe, expect, it } from "vitest";

import { diffScalarFields, deepEqual } from "./change-diff";

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

describe("diffScalarFields (stage v1 shape)", () => {
  it("diffs v1 med column", () => {
    const before: Record<string, unknown> = {
      med_management_v1: "self",
      alone_safety_v1: ["nothing"],
    };
    const after: Record<string, unknown> = { ...before, med_management_v1: "reminders" };
    const d = diffScalarFields("stage", before, after);
    expect(d).toEqual([
      {
        section: "stage",
        field: "med_management_v1",
        oldValue: "self",
        newValue: "reminders",
      },
    ]);
  });
});
