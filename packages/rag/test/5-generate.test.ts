import { describe, expect, it, vi } from "vitest";

import type { GenerateInput, GenerateOutput } from "../src/bedrock/claude.js";
import { generate } from "../src/layers/5-generate.js";

describe("layer 5 — generate (unit, mocked)", () => {
  it("forwards the system + user prompts to the injected generator", async () => {
    const fakeGen = vi.fn(
      async (_in: GenerateInput): Promise<GenerateOutput> => ({
        text: "Try a calm afternoon routine. [1]",
        modelId: "fake-model",
        inputTokens: 10,
        outputTokens: 6,
        stopReason: "end_turn",
      }),
    );
    const r = await generate(
      { systemPrompt: "SYS", userPrompt: "USR" },
      { generate: fakeGen },
    );
    expect(fakeGen).toHaveBeenCalledWith({ systemPrompt: "SYS", userPrompt: "USR" });
    expect(r.text).toContain("[1]");
    expect(r.modelId).toBe("fake-model");
    expect(r.inputTokens).toBe(10);
    expect(r.outputTokens).toBe(6);
    expect(r.stopReason).toBe("end_turn");
  });
});

describe.skipIf(!process.env.RAG_LIVE)(
  "layer 5 — generate (live, RAG_LIVE=1)",
  () => {
    it("returns a non-empty string from Bedrock Claude", async () => {
      const { invokeClaude } = await import("../src/bedrock/claude.js");
      const r = await generate(
        {
          systemPrompt: "Reply with the single word OK.",
          userPrompt: "ping",
        },
        { generate: invokeClaude },
      );
      expect(r.text.length).toBeGreaterThan(0);
    }, 30_000);
  },
);
