import { describe, expect, it, vi } from "vitest";

import type { ClassifyDeps } from "@hypercare/safety";

import { classifySafety, type SafetyLayerDeps } from "../src/layers/0-safety.js";

function buildLayerDeps(over: Partial<ClassifyDeps> = {}): SafetyLayerDeps {
  return {
    classifyDeps: {
      persist: vi.fn(async () => undefined),
      disableLlm: true,
      ...over,
    },
  };
}

describe("layer 0 — safety adapter (TASK-010)", () => {
  it("forwards a routine question through as triaged: false (no persist)", async () => {
    const deps = buildLayerDeps();
    const r = await classifySafety(
      { userId: "user-1", question: "what is sundowning" },
      deps,
    );
    expect(r).toEqual({ triaged: false });
    expect(deps.classifyDeps.persist).not.toHaveBeenCalled();
  });

  it("triages a Layer-A self-harm phrase and writes a safety_flags row", async () => {
    const deps = buildLayerDeps();
    const r = await classifySafety(
      { userId: "user-1", question: "i want to kill myself" },
      deps,
    );
    expect(r.triaged).toBe(true);
    if (r.triaged) {
      expect(r.category).toBe("self_harm_user");
      expect(r.suggestedAction).toBe("call_988");
      expect(r.severity).toBe("high");
      expect(r.source).toBe("rule");
    }
    expect(deps.classifyDeps.persist).toHaveBeenCalledTimes(1);
  });
});
