import { describe, it } from "vitest";

const live = process.env.EVAL_LIVE === "1" && Boolean(process.env.DATABASE_URL);

describe("routing no-regression (EVAL_LIVE)", () => {
  it.skipIf(!live)("placeholder — run `pnpm --filter @alongside/eval start -- answers` with MODEL_ROUTING on/off per release checklist", () => {
    // Full regression is the existing answers harness + operator review; this
    // file reserves the CI hook described in TASK-042 without slowing default CI.
  });
});
