import { describe, expect, it, vi } from "vitest";

import {
  aggregateRuleHits,
  classify,
  runAllRules,
} from "../src/classify.js";
import { parseLlmJson } from "../src/llm/classifier.js";
import type { ClassifyDeps } from "../src/classify.js";
import type { PersistFn } from "../src/persist.js";

/* Helper kept for clarity; some tests build their own deps inline to assert
 * mock call counts directly. */
function _buildDeps(over: Partial<ClassifyDeps> = {}): ClassifyDeps {
  const persist: PersistFn = vi.fn(async () => undefined);
  return {
    persist,
    disableLlm: true,
    ...over,
  };
}
void _buildDeps;

describe("aggregateRuleHits — severity/order tie-breaks", () => {
  it("returns null on no hits", () => {
    expect(aggregateRuleHits([])).toBeNull();
  });

  it("highest severity wins over a medium hit", () => {
    const r = aggregateRuleHits([
      { category: "neglect", ruleId: "ne_x", severity: "medium" },
      { category: "self_harm_user", ruleId: "sh_user_kill_myself", severity: "high" },
    ]);
    expect(r?.category).toBe("self_harm_user");
    expect(r?.severity).toBe("high");
    expect(r?.suggestedAction).toBe("call_988");
  });

  it("on tied severity, the earlier-listed category wins (CATEGORY_RULES order)", () => {
    const r = aggregateRuleHits([
      { category: "abuse_caregiver_to_cr", ruleId: "ab_cg_hit_cr", severity: "high" },
      { category: "self_harm_user", ruleId: "sh_user_kill_myself", severity: "high" },
    ]);
    // CATEGORY_RULES lists self_harm_user before abuse_caregiver_to_cr.
    expect(r?.category).toBe("self_harm_user");
  });

  it("matchedSignals contains only the winning category's rule ids", () => {
    const r = aggregateRuleHits([
      { category: "self_harm_user", ruleId: "sh_user_kill_myself", severity: "high" },
      { category: "self_harm_user", ruleId: "sh_user_end_my_life", severity: "high" },
      { category: "neglect", ruleId: "ne_x", severity: "medium" },
    ]);
    expect(r?.matchedSignals.sort()).toEqual([
      "sh_user_end_my_life",
      "sh_user_kill_myself",
    ]);
  });
});

describe("classify — Layer A (rules) wins, no LLM call", () => {
  it("triages a self-harm question without invoking the LLM", async () => {
    const llmInvoke = vi.fn();
    const persist = vi.fn(async () => undefined);
    const r = await classify(
      { userId: "u1", text: "I want to kill myself, I can't do this anymore" },
      { persist, llmInvoke },
    );
    expect(r.triaged).toBe(true);
    if (r.triaged) {
      expect(r.category).toBe("self_harm_user");
      expect(r.severity).toBe("high");
      expect(r.suggestedAction).toBe("call_988");
      expect(r.source).toBe("rule");
      expect(r.matchedSignals.length).toBeGreaterThan(0);
    }
    expect(llmInvoke).not.toHaveBeenCalled();
    expect(persist).toHaveBeenCalledTimes(1);
    const call = (persist as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(call.userId).toBe("u1");
    expect(call.source).toBe("rule");
    expect(call.category).toBe("self_harm_user");
    expect(call.messageText).toContain("kill myself");
  });

  it("returns triaged: false on a routine caregiver question (Layer A miss + LLM disabled)", async () => {
    const persist = vi.fn(async () => undefined);
    const r = await classify(
      { userId: "u1", text: "how do I help my mom with bathing" },
      { persist, disableLlm: true },
    );
    expect(r).toEqual({ triaged: false });
    expect(persist).not.toHaveBeenCalled();
  });
});

describe("classify — Layer B (LLM) on Layer A miss", () => {
  it("triages a subtle signal via the LLM and persists with source=llm", async () => {
    const llmInvoke = vi.fn(async () =>
      JSON.stringify({
        triaged: true,
        category: "self_harm_user",
        severity: "high",
        evidence: "don't see the point some days",
      }),
    );
    const persist = vi.fn(async () => undefined);
    const r = await classify(
      {
        userId: "u2",
        text: "Things have been really hard and I don't see the point some days",
      },
      { persist, llmInvoke },
    );
    expect(r.triaged).toBe(true);
    if (r.triaged) {
      expect(r.source).toBe("llm");
      expect(r.category).toBe("self_harm_user");
      expect(r.suggestedAction).toBe("call_988");
      expect(r.matchedSignals[0]).toContain("point");
    }
    expect(llmInvoke).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
    const call = (persist as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(call.source).toBe("llm");
  });

  it("returns triaged: false when the LLM says triaged: false", async () => {
    const llmInvoke = vi.fn(async () => JSON.stringify({ triaged: false }));
    const persist = vi.fn(async () => undefined);
    const r = await classify(
      { userId: "u1", text: "how do I help with sundowning" },
      { persist, llmInvoke },
    );
    expect(r).toEqual({ triaged: false });
    expect(persist).not.toHaveBeenCalled();
  });

  it("downgrades to triaged: false on malformed LLM JSON without throwing", async () => {
    const llmInvoke = vi.fn(async () => "not json at all");
    const persist = vi.fn(async () => undefined);
    const warn = vi.fn();
    const r = await classify(
      { userId: "u1", text: "ambiguous text the llm can't parse" },
      { persist, llmInvoke, warn },
    );
    expect(r).toEqual({ triaged: false });
    expect(warn).toHaveBeenCalled();
  });

  /** ADR 0009: miss Layer B on outage rather than stalling; warn for observability. */
  it("downgrades to triaged: false when invoke throws (Bedrock outage)", async () => {
    const llmInvoke = vi.fn(async () => {
      throw new Error("Bedrock 503");
    });
    const persist = vi.fn(async () => undefined);
    const warn = vi.fn();
    const r = await classify(
      { userId: "u1", text: "anything" },
      { persist, llmInvoke, warn },
    );
    expect(r).toEqual({ triaged: false });
    expect(warn).toHaveBeenCalledWith(
      "safety.llm.invoke_failed",
      expect.any(Object),
    );
  });
});

describe("parseLlmJson", () => {
  it("strips a ```json fence", () => {
    const r = parseLlmJson('```json\n{"triaged": false}\n```');
    expect(r).toEqual({ triaged: false });
  });

  it("rejects an invented category", () => {
    const r = parseLlmJson(
      JSON.stringify({
        triaged: true,
        category: "made_up_category",
        severity: "high",
        evidence: "x",
      }),
    );
    expect(r).toEqual({ triaged: false });
  });
});

describe("runAllRules — sanity", () => {
  it("returns empty for routine text", () => {
    expect(runAllRules("how do I help with sundowning")).toEqual([]);
  });

  it("can return multiple hits across categories", () => {
    const hits = runAllRules(
      "I want to kill myself and she is not breathing",
    );
    const cats = new Set(hits.map((h) => h.category));
    expect(cats.has("self_harm_user")).toBe(true);
    expect(cats.has("acute_medical")).toBe(true);
  });
});

describe("classify — buildDefaults wiring", () => {
  it("classify accepts deps with persist + disabled llm and never calls db.insert directly", async () => {
    const calls: unknown[] = [];
    const persist: PersistFn = async (row) => {
      calls.push(row);
    };
    const r = await classify(
      { userId: "u1", text: "I want to kill myself" },
      { persist, disableLlm: true },
    );
    expect(r.triaged).toBe(true);
    expect(calls).toHaveLength(1);
  });
});
