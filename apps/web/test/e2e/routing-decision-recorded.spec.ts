import { expect, test } from "@playwright/test";

const e2eSecret = process.env.E2E_SETUP_SECRET ?? "";

/**
 * Opt-in live-stack check (TASK-042): requires migrated DB, `MODEL_ROUTING=1`,
 * real Bedrock, and no RAG mock. Default CI skips.
 */
test.describe("model routing decision log", () => {
  test.skip(process.env.ROUTING_E2E !== "1", "Set ROUTING_E2E=1 for optional live routing E2E");

  test("placeholder — exercise chat with routing cohort query params + assert DB row", async () => {
    expect(e2eSecret.length).toBeGreaterThan(0);
  });
});
