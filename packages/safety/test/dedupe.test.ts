import { describe, expect, it, vi } from "vitest";

import { classify } from "../src/classify.js";
import type { PersistFn } from "../src/persist.js";

/**
 * 5-minute dedupe is implemented in `makeDbPersist` against Postgres.
 * Here we assert the contract: `classify` surfaces `repeatInWindow` from the persist layer.
 */
describe("safety flag dedupe signal (TASK-025)", () => {
  it("sets repeatInWindow from persist on Layer-A triage", async () => {
    const persist: PersistFn = vi
      .fn()
      .mockResolvedValueOnce({ repeatInWindow: false })
      .mockResolvedValueOnce({ repeatInWindow: true });
    const a = await classify(
      { userId: "u1", text: "I want to kill myself" },
      { persist, disableLlm: true },
    );
    const b = await classify(
      { userId: "u1", text: "I want to kill myself" },
      { persist, disableLlm: true },
    );
    expect(a.triaged && a.repeatInWindow).toBe(false);
    expect(b.triaged && b.repeatInWindow).toBe(true);
  });
});
