import { describe, expect, it, vi } from "vitest";

import { classify } from "../src/classify.js";
import type { ClassifyDeps } from "../src/classify.js";
import type { PersistFn } from "../src/persist.js";
import type { FtShadowLogInput } from "../src/shadow-log.js";

describe("TASK-039 — SAFETY_FT_SHADOW", () => {
  it("when SAFETY_FT_SHADOW=1, live decision is zero-shot and shadow logger receives both verdicts", async () => {
    const prev = process.env.SAFETY_FT_SHADOW;
    process.env.SAFETY_FT_SHADOW = "1";
    const persist: PersistFn = vi.fn(async () => ({ repeatInWindow: false }));
    const shadowRows: FtShadowLogInput[] = [];
    const logFtShadow = async (row: FtShadowLogInput) => {
      shadowRows.push(row);
    };
    const llmInvoke = vi.fn(async () =>
      JSON.stringify({
        triaged: true,
        category: "acute_medical",
        severity: "high",
        evidence: "zs",
      }),
    );
    const llmInvokeFineTuned = vi.fn(async () =>
      JSON.stringify({
        triaged: true,
        category: "self_harm_user",
        severity: "high",
        evidence: "ft",
      }),
    );
    const deps: ClassifyDeps = {
      persist,
      llmInvoke,
      llmInvokeFineTuned,
      logFtShadow,
    };
    try {
      const r = await classify(
        { userId: "u1", text: "how do I help with sundowning shadow uniq 7f3c" },
        deps,
      );
      expect(r.triaged).toBe(true);
      if (r.triaged) expect(r.category).toBe("acute_medical");
      expect(shadowRows).toHaveLength(1);
      const arg = shadowRows[0]!;
      expect(arg.zeroShot.triaged).toBe(true);
      expect(arg.fineTuned.triaged).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.SAFETY_FT_SHADOW;
      else process.env.SAFETY_FT_SHADOW = prev;
    }
  });
});
