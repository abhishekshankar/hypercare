/**
 * Unit tests for {@link enrichSafetyTriageReason} (TASK-025). Verifies that the
 * server attaches the right pre-scripted markdown for each PRD §10.3 category
 * and interpolates the CR's name into the body.
 */
import { describe, expect, it, vi } from "vitest";
import type { SafetyTriageReason } from "@hypercare/rag";

vi.mock("@/lib/env.server", () => ({
  serverEnv: { DATABASE_URL: "postgresql://127.0.0.1:5432/hc_test" },
}));

import { enrichSafetyTriageReason } from "@/lib/safety/enrich-triage";

function baseReason(
  category: SafetyTriageReason["category"],
  suggestedAction: SafetyTriageReason["suggestedAction"] = "show_crisis_strip_emphasis",
): SafetyTriageReason {
  return {
    code: "safety_triaged",
    category,
    severity: "high",
    suggestedAction,
    source: "rule",
  };
}

describe("enrichSafetyTriageReason (TASK-025)", () => {
  it("attaches caregiver-self-harm script for self_harm_user", () => {
    const out = enrichSafetyTriageReason(
      baseReason("self_harm_user", "call_988"),
      "I can't keep doing this, I want it to stop",
      { crName: "Mom" },
    );
    expect(out.script.version).toBeGreaterThanOrEqual(1);
    expect(out.script.direct_answer.length).toBeGreaterThan(0);
    const titles = out.script.primary_resources.map((r) => r.label.toLowerCase());
    expect(titles.some((t) => t.includes("988") || t.includes("suicide"))).toBe(true);
  });

  it("attaches CR-in-danger script for self_harm_cr", () => {
    const out = enrichSafetyTriageReason(
      baseReason("self_harm_cr", "call_911"),
      "I think she might hurt herself",
      { crName: "Mom" },
    );
    expect(out.script.body_md).toContain("Mom");
    expect(
      out.script.primary_resources.some((r) => /911|988/.test(r.label)),
    ).toBe(true);
  });

  it("routes wandering text to a wandering-aware script via resolveScriptFilename", () => {
    const out = enrichSafetyTriageReason(
      baseReason("acute_medical", "call_911"),
      "He is wandering somewhere and missing right now",
      { crName: "Dad" },
    );
    expect(out.script.body_md).toMatch(/wander|silver alert|find/i);
  });

  it("attaches the medical-emergency script for chest-pain style queries", () => {
    const out = enrichSafetyTriageReason(
      baseReason("acute_medical", "call_911"),
      "Mom is having chest pain right now, what should I do?",
      { crName: "Mom" },
    );
    expect(/911/.test(out.script.body_md) || /911/.test(out.script.direct_answer)).toBe(
      true,
    );
  });

  it("attaches an elder-abuse disclosure for abuse_caregiver_to_cr", () => {
    const out = enrichSafetyTriageReason(
      baseReason("abuse_caregiver_to_cr", "call_adult_protective_services"),
      "I lost my temper and pushed him today",
      { crName: "Dad" },
    );
    expect(out.script.disclosure).toBeDefined();
    expect(out.script.disclosure ?? "").toMatch(
      /report|adult protective|aps|reportable|state/i,
    );
  });

  it("does not attach a mandatory disclosure for the financial exploitation script", () => {
    const out = enrichSafetyTriageReason(
      baseReason("abuse_cr_to_caregiver", "call_adult_protective_services"),
      "He hits me when he's confused",
      { crName: "Dad" },
    );
    expect(out.script.disclosure).toBeUndefined();
  });

  it("does not interpolate {{CR_NAME}} placeholders in the rendered body", () => {
    const out = enrichSafetyTriageReason(
      baseReason("self_harm_cr", "call_911"),
      "I'm worried about her",
      { crName: "Mom" },
    );
    expect(out.script.body_md).not.toContain("{{CR_NAME}}");
    expect(out.script.direct_answer).not.toContain("{{CR_NAME}}");
  });

  it("preserves the original triage fields alongside the script", () => {
    const reason = baseReason("self_harm_user", "call_988");
    const out = enrichSafetyTriageReason(reason, "I want it to stop", {
      crName: "Mom",
    });
    expect(out.code).toBe("safety_triaged");
    expect(out.category).toBe("self_harm_user");
    expect(out.severity).toBe("high");
    expect(out.suggestedAction).toBe("call_988");
    expect(out.source).toBe("rule");
  });
});
