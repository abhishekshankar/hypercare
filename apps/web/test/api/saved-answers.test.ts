import { describe, expect, it } from "vitest";

import { decodeSaveListCursor, encodeSaveListCursor } from "@/lib/saved/cursor";
import { moduleSlugsFromCitations } from "@/lib/saved/citations-to-slugs";
import { escapeIlikeForContains } from "@/lib/saved/escape-ilike";

/**
 * Unit tests for saved-answers helpers: cursor, search escape, module slugs.
 * Full CRUD + list SQL paths are covered in e2e/save-and-revisit.spec.ts.
 */
describe("saved-answers: cursor", () => {
  it("round-trips for pagination", () => {
    const c = { savedAt: "2026-01-01T00:00:00.000Z", id: "00000000-0000-4000-8000-000000000001" };
    const enc = encodeSaveListCursor(c);
    expect(decodeSaveListCursor(enc)).toEqual(c);
  });

  it("rejects bad cursor", () => {
    expect(decodeSaveListCursor("___")).toBe(null);
  });
});

describe("saved-answers: ilike escape", () => {
  it("escapes % and _ for contains patterns", () => {
    expect(escapeIlikeForContains("100%_")).toBe("100\\%\\_");
  });
});

describe("saved-answers: module slugs from citations", () => {
  it("dedupes and picks moduleSlug from citation objects", () => {
    const slugs = moduleSlugsFromCitations([
      { moduleSlug: "a", chunkId: "1" },
      { moduleSlug: "a", chunkId: "2" },
      { moduleSlug: "b" },
    ]);
    expect(slugs).toEqual(["a", "b"]);
  });
});
