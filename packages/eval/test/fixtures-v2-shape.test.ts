import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

import { resolveScriptFilename } from "@hypercare/safety";
import { loadRedteamFixture } from "../src/redteam/load-yaml.js";
import { REDTEAM_BUCKETS } from "../src/redteam/schema.js";

const _d = dirname(fileURLToPath(import.meta.url));
const safetyScripts = join(_d, "../../safety/src/scripts");

describe("redteam-v2 fixture shape (TASK-035)", () => {
  it("loads 250 rows with category + expected_flow + source; scripts exist on disk", async () => {
    const q = await loadRedteamFixture("redteam-v2.yaml");
    expect(q).toHaveLength(250);
    const lived = q.filter((x) => x.source === "lived_experience");
    expect(lived.length).toBeGreaterThanOrEqual(50);
    for (const row of q) {
      expect(row.id.length).toBeGreaterThan(0);
      if (row.expected.triaged && row.expected.category) {
        const flow =
          row.expected_flow ??
          resolveScriptFilename(row.expected.category, row.text);
        expect(flow).toBeTruthy();
        if (flow) {
          expect(existsSync(join(safetyScripts, flow))).toBe(true);
        }
      } else {
        expect(row.expected_flow === null || row.expected_flow === undefined).toBe(true);
      }
    }
  });

  it("matches PRD category targets", async () => {
    const want: Record<string, number> = {
      caregiver_self_harm: 32,
      care_recipient_in_danger: 36,
      elder_abuse_or_caregiver_breaking_point: 32,
      dangerous_request: 30,
      medical_emergency_disguised_as_question: 36,
      financial_or_legal_exploitation: 22,
      soft_flag_gray_zone: 30,
      non_crisis_everyday_caregiver: 32,
    };
    const q = await loadRedteamFixture("redteam-v2.yaml");
    const counts: Record<string, number> = {};
    for (const b of REDTEAM_BUCKETS) counts[b] = 0;
    for (const x of q) {
      counts[x.bucket] = (counts[x.bucket] ?? 0) + 1;
    }
    for (const b of REDTEAM_BUCKETS) {
      expect(counts[b]).toBe(want[b]);
    }
  });

  it("redteam-v2-latest.json artifact is parseable if present", async () => {
    const p = join(_d, "../artifacts/redteam-v2-latest.json");
    if (!existsSync(p)) {
      return;
    }
    const j = JSON.parse(await readFile(p, "utf8")) as { by_bucket?: object; pass_rate?: number };
    expect(j.by_bucket).toBeDefined();
    expect(typeof j.pass_rate).toBe("number");
  });
});
