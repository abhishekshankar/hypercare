import { describe, expect, it, vi } from "vitest";

import { classify } from "../src/classify.js";
import type { ClassifyDeps } from "../src/classify.js";
import type { PersistFn } from "../src/persist.js";

describe("TASK-039 — Layer-B classifier routing", () => {
  it("layerBClassifierOverride fine_tuned uses fine-tuned invoke path", async () => {
    const persist: PersistFn = vi.fn(async () => ({ repeatInWindow: false }));
    const llmInvoke = vi.fn(async () =>
      JSON.stringify({ triaged: false }),
    );
    const llmInvokeFineTuned = vi.fn(async () =>
      JSON.stringify({
        triaged: true,
        category: "self_harm_user",
        severity: "high",
        evidence: "test",
      }),
    );
    const deps: ClassifyDeps = {
      persist,
      llmInvoke,
      llmInvokeFineTuned,
      layerBClassifierOverride: "fine_tuned",
    };
    const r = await classify(
      { userId: "u1", text: "calendar tips for two phones same account uuid-ft-1a2b" },
      deps,
    );
    expect(r.triaged).toBe(true);
    if (r.triaged) expect(r.category).toBe("self_harm_user");
    expect(llmInvokeFineTuned).toHaveBeenCalledTimes(1);
    expect(llmInvoke).not.toHaveBeenCalled();
  });

  it("fine-tuned invoke throws then falls back to zero-shot (live path)", async () => {
    const persist: PersistFn = vi.fn(async () => ({ repeatInWindow: false }));
    const llmInvoke = vi.fn(async () =>
      JSON.stringify({
        triaged: true,
        category: "neglect",
        severity: "medium",
        evidence: "from zero",
      }),
    );
    const llmInvokeFineTuned = vi.fn(async () => {
      throw new Error("throttle");
    });
    const warn = vi.fn();
    const deps: ClassifyDeps = {
      persist,
      llmInvoke,
      llmInvokeFineTuned,
      layerBClassifierOverride: "fine_tuned",
      warn,
    };
    const r = await classify(
      { userId: "u1", text: "meal prep ideas low sodium uuid-ft-fallback-9z" },
      deps,
    );
    expect(warn).toHaveBeenCalledWith(
      "safety.ft.invoke_failed",
      expect.objectContaining({ error: expect.stringContaining("throttle") }),
    );
    expect(r.triaged).toBe(true);
    if (r.triaged) expect(r.category).toBe("neglect");
    expect(llmInvoke).toHaveBeenCalledTimes(1);
  });

  it("both fine-tuned and zero-shot throw → triaged false (ADR 0009)", async () => {
    const persist: PersistFn = vi.fn(async () => ({ repeatInWindow: false }));
    const llmInvoke = vi.fn(async () => {
      throw new Error("bedrock down");
    });
    const llmInvokeFineTuned = vi.fn(async () => {
      throw new Error("ft down");
    });
    const warn = vi.fn();
    const r = await classify(
      { userId: "u1", text: "no rule match zz999 unique" },
      { persist, llmInvoke, llmInvokeFineTuned, layerBClassifierOverride: "fine_tuned", warn },
    );
    expect(r).toEqual({ triaged: false });
    expect(warn).toHaveBeenCalledWith(
      "safety.llm.invoke_failed",
      expect.objectContaining({ error: expect.stringContaining("bedrock") }),
    );
  });
});
