import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * ADR 0010 / `messages.citations` jsonb: the thread UI reads denormalized
 * citation payloads from `messages` only. If a chunk is re-embedded later,
 * historical assistant rows must still show the snippet / heading stored on
 * the message — not a live join to `module_chunks` that could drift.
 *
 * This test locks that implementation shape (no `module_chunks` join in the
 * loader). The behavioral claim (`UPDATE module_chunks` does not change
 * `messages.citations`) is covered by `packages/db/test/citations-denorm.integration.test.ts`
 * when `CITATIONS_DENORM_INTEGRATION=1` (see `tasks/SPRINT-PREFLIGHT.md`).
 */
describe("loadThread citation denormalization (source contract)", () => {
  it("loadThread source selects citations from messages only, not module_chunks", () => {
    const path = join(here, "load.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("citations: messages.citations");
    expect(src).not.toContain("module_chunks");
  });
});
