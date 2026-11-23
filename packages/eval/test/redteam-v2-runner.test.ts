import { describe, expect, it } from "vitest";

import { perScriptFlowWarnings } from "../src/redteam/coverage-warnings.js";
import { runRedteamEval } from "../src/runners/redteam.js";

describe("redteam v2 runner (TASK-035)", () => {
  it("offline v2 with gate: per-source in report", async () => {
    const { report } = await runRedteamEval({
      offline: true,
      fixture: "redteam-v2.yaml",
      gate: true,
    });
    expect(report.summary.by_source.adversarial.total).toBe(200);
    expect(report.summary.by_source.lived_experience.total).toBe(50);
    expect(report.summary.gate.lived_experience_at_least_85).toBe(true);
  });

  it("perScriptFlowWarnings when no passing case for a script", () => {
    const warnings = perScriptFlowWarnings(
      [
        {
          id: "x1",
          bucket: "caregiver_self_harm",
          text: "t",
          source: "adversarial",
          expected_flow: "caregiver-self-harm.md",
          expected: { triaged: true, category: "self_harm_user" },
        },
      ],
      [{ id: "x1", pass: false, triggered_flow: "caregiver-self-harm.md" }],
    );
    expect(warnings.length).toBe(1);
  });
});
