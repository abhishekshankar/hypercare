import { describe, expect, it } from "vitest";

import { MEMORY_MAX_TOKENS } from "../../src/config.js";
import { shouldRunMemoryRefresh } from "../../src/memory/refresh.js";
import { verifyMemorySummaryBannedContent } from "../../src/memory/verify-banned.js";
import { estimateTokenCount } from "../../src/memory/tokens.js";

describe("memory refresh policy", () => {
  it("turn 1–2: no refresh; turn 3,6,9: yes (N=3)", () => {
    expect(shouldRunMemoryRefresh({ userMessageCountAfterThisTurn: 1, memoryInvalidated: false })).toBe(false);
    expect(shouldRunMemoryRefresh({ userMessageCountAfterThisTurn: 2, memoryInvalidated: false })).toBe(false);
    expect(shouldRunMemoryRefresh({ userMessageCountAfterThisTurn: 3, memoryInvalidated: false })).toBe(true);
    expect(shouldRunMemoryRefresh({ userMessageCountAfterThisTurn: 4, memoryInvalidated: false })).toBe(false);
    expect(shouldRunMemoryRefresh({ userMessageCountAfterThisTurn: 6, memoryInvalidated: false })).toBe(true);
  });

  it("invalidation forces refresh even when count is not a multiple of N", () => {
    expect(shouldRunMemoryRefresh({ userMessageCountAfterThisTurn: 4, memoryInvalidated: true })).toBe(true);
  });
});

describe("banned content + token budget", () => {
  it("rejects medication name", () => {
    const r = verifyMemorySummaryBannedContent("Try donepezil schedule");
    expect(r.ok).toBe(false);
  });

  it("estimateTokenCount flags overflow vs MAX", () => {
    const s = "x".repeat(MEMORY_MAX_TOKENS * 4 + 10);
    expect(estimateTokenCount(s)).toBeGreaterThan(MEMORY_MAX_TOKENS);
  });
});
