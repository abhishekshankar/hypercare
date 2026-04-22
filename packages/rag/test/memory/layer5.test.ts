import { describe, expect, it } from "vitest";

import { compose } from "../../src/layers/4-compose.js";
import { makeChunk } from "../fixtures.js";

describe("Layer 5 user prompt — memory & profile slots (TASK-027)", () => {
  it("without memory or profile matches legacy shape (CONTEXT empty, question + sources only)", () => {
    const chunks = [makeChunk({ chunkId: "c1", distance: 0.1 })];
    const r = compose({ scrubbedQuestion: "sleep help", chunks });
    expect(r.userPrompt.startsWith("CAREGIVER QUESTION:")).toBe(true);
    expect(r.userPrompt).toContain("sleep help");
    expect(r.userPrompt).not.toContain("What we've been discussing");
  });

  it("with memory only: block appears between CONTEXT and CAREGIVER QUESTION", () => {
    const chunks = [makeChunk({ chunkId: "c1", distance: 0.1 })];
    const r = compose({
      scrubbedQuestion: "follow up",
      chunks,
      conversationMemoryMd: "## Current focus\n- Test",
    });
    const idxMem = r.userPrompt.indexOf("What we've been discussing");
    const idxQ = r.userPrompt.indexOf("CAREGIVER QUESTION:");
    expect(idxMem).toBeGreaterThan(-1);
    expect(idxQ).toBeGreaterThan(idxMem);
  });
});
