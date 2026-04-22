import { describe, expect, it } from "vitest";

import { augmentMemoryUserMessageWithForgotten, forgottenVerifierRetryPrefix } from "../../src/memory/prompt-forgotten.js";
import { verifyMemorySummaryForgottenContent } from "../../src/memory/verify-forgotten.js";

describe("memory forgotten (TASK-033)", () => {
  it("augmentMemoryUserMessageWithForgotten includes each line", () => {
    const base = "TRANSCRIPT HERE";
    const out = augmentMemoryUserMessageWithForgotten(base, ["alpha", " beta "]);
    expect(out).toContain("alpha");
    expect(out).toContain("beta");
    expect(out.endsWith(base)).toBe(true);
  });

  it("forbiddenVerifierRetryPrefix lists facts", () => {
    const p = forgottenVerifierRetryPrefix(["x"]);
    expect(p).toContain("x");
    expect(p.toLowerCase()).toContain("forget");
  });

  it("verifyMemorySummaryForgottenContent is case-insensitive substring", () => {
    expect(verifyMemorySummaryForgottenContent("Hello WORLD", ["world"]).ok).toBe(false);
    expect(verifyMemorySummaryForgottenContent("Hello", ["world"]).ok).toBe(true);
  });

  it("verifier rejects summary that reintroduces a forgotten string", () => {
    const bad = verifyMemorySummaryForgottenContent("## Current focus\n- still mentions sundowning help\n", [
      "sundowning",
    ]);
    expect(bad.ok).toBe(false);
  });
});
