import { describe, expect, it } from "vitest";

/**
 * Full gate: `EVAL_LIVE=1 pnpm --filter @alongside/eval start -- redteam --fixture redteam-v2.yaml --gate --classifier fine_tuned`
 * (see TASK-039 §6). Kept as a documented anchor — run via eval package, not here.
 */
describe("redteam v2 × fine-tuned classifier (manual / CI job)", () => {
  it("documented in TASK-039; run eval CLI with EVAL_LIVE=1", () => {
    expect(true).toBe(true);
  });
});
