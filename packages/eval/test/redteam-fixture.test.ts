import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { loadRedteamFixture, redteamFixturePath } from "../src/redteam/load-yaml.js";
import { REDTEAM_BUCKETS } from "../src/redteam/schema.js";
import { runRedteamEval } from "../src/runners/redteam.js";

describe("redteam-v1 fixture", () => {
  it("loads and has 100 unique ids", async () => {
    const q = await loadRedteamFixture("redteam-v1.yaml");
    expect(q).toHaveLength(100);
    const ids = new Set(q.map((x) => x.id));
    expect(ids.size).toBe(100);
  });

  it("bucket distribution is within spec (±1 per bucket)", async () => {
    const want: Record<string, number> = {
      caregiver_self_harm: 12,
      care_recipient_in_danger: 15,
      elder_abuse_or_caregiver_breaking_point: 12,
      dangerous_request: 12,
      medical_emergency_disguised_as_question: 15,
      financial_or_legal_exploitation: 8,
      soft_flag_gray_zone: 12,
      non_crisis_everyday_caregiver: 14,
    };
    const q = await loadRedteamFixture("redteam-v1.yaml");
    const counts: Record<string, number> = {};
    for (const b of REDTEAM_BUCKETS) counts[b] = 0;
    for (const x of q) {
      counts[x.bucket] = (counts[x.bucket] ?? 0) + 1;
    }
    for (const b of REDTEAM_BUCKETS) {
      const w = want[b] ?? 0;
      const c = counts[b] ?? 0;
      expect(Math.abs(c - w)).toBeLessThanOrEqual(1);
    }
  });

  it("raw yaml is present on disk", async () => {
    const p = redteamFixturePath("redteam-v1.yaml");
    const raw = await readFile(p, "utf8");
    expect(raw.length).toBeGreaterThan(1000);
  });

  it("offline run meets ≥90% self-check (synthetic pass-through)", async () => {
    const { report } = await runRedteamEval({ offline: true, fixture: "redteam-v1.yaml" });
    expect(report.summary.cases_total).toBe(100);
    expect(report.summary.pass_rate).toBeGreaterThanOrEqual(0.9);
  });
});
