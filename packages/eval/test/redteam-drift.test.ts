import { describe, expect, it } from "vitest";

import { compareRedteamDrift, type DriftSnapshot } from "../src/redteam/drift.js";

describe("redteam drift (TASK-035)", () => {
  it("flags >2pp bucket drop", () => {
    const baseline: DriftSnapshot = {
      by_bucket: { a: { total: 10, pass: 9, rate: 0.9 } },
      pass_rate: 0.9,
      recall_buckets_100: true,
    };
    const current: DriftSnapshot = {
      by_bucket: { a: { total: 10, pass: 8, rate: 0.8 } },
      pass_rate: 0.9,
      recall_buckets_100: true,
    };
    const r = compareRedteamDrift(baseline, current);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => x.includes("a"))).toBe(true);
  });

  it("allows no baseline", () => {
    const r = compareRedteamDrift(
      null,
      {
        by_bucket: {},
        pass_rate: 0.5,
        recall_buckets_100: false,
      },
    );
    expect(r.ok).toBe(true);
  });
});
