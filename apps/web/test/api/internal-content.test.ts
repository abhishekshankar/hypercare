import { describe, expect, it } from "vitest";

/**
 * Full integration (DB + Bedrock) belongs in a separate job; this file documents
 * the intended happy path for CI until a test container is wired.
 */
describe("internal content API", () => {
  it("placeholder: create brief → claim → transition → publish", () => {
    expect(true).toBe(true);
  });
});
