import { describe, expect, it } from "vitest";

import { compose } from "../src/layers/4-compose.js";
import { SYSTEM_PROMPT, USER_TEMPLATE } from "../src/prompts/loader.js";
import { makeChunk } from "./fixtures.js";

describe("layer 4 — compose", () => {
  it("loads system + user templates from disk at module load", () => {
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(50);
    expect(USER_TEMPLATE).toContain("{{QUESTION}}");
    expect(USER_TEMPLATE).toContain("{{SOURCES}}");
  });

  it("injects question and numbered [1]..[k] sources", () => {
    const chunks = [
      makeChunk({ chunkId: "x", distance: 0.1, sectionHeading: "S1" }),
      makeChunk({ chunkId: "y", distance: 0.2, sectionHeading: "S2" }),
    ];
    const r = compose({ scrubbedQuestion: "why agitated", chunks });
    expect(r.systemPrompt).toContain("Hypercare");
    expect(r.userPrompt).toContain("why agitated");
    expect(r.userPrompt).toContain("[1]");
    expect(r.userPrompt).toContain("[2]");
    expect(r.userPrompt).not.toContain("{{QUESTION}}");
    expect(r.userPrompt).not.toContain("{{SOURCES}}");
    expect(r.sourceMap.map((c) => c.chunkId)).toEqual(["x", "y"]);
  });

  it("throws when given zero chunks (caller must refuse first)", () => {
    expect(() => compose({ scrubbedQuestion: "x", chunks: [] })).toThrow();
  });
});
