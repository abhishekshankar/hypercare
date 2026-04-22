import { describe, expect, it } from "vitest";

import { librarySubstringMatchScore, normalizeLibrarySearchQuery } from "../src/library/library-search-score.js";

describe("normalizeLibrarySearchQuery", () => {
  it("trims and lowercases", () => {
    expect(normalizeLibrarySearchQuery("  BaTh ")).toBe("bath");
  });
});

describe("librarySubstringMatchScore (TASK-023 parity)", () => {
  const haystack = "bathing: when the answer is no bathing resistance";

  it("returns 0 when query not contained (legacy includes false)", () => {
    expect(librarySubstringMatchScore(haystack, "xyz")).toBe(0);
  });

  it("returns 0 for empty query", () => {
    expect(librarySubstringMatchScore(haystack, "")).toBe(0);
  });

  it("matches legacy includes true with positive score", () => {
    const q = normalizeLibrarySearchQuery("bath");
    expect(haystack.includes(q)).toBe(true);
    expect(librarySubstringMatchScore(haystack, q)).toBeGreaterThan(0);
  });

  it("scores earlier substring higher (position weighting)", () => {
    const sEarly = librarySubstringMatchScore(haystack, "bath");
    const sLate = librarySubstringMatchScore(haystack, "resistance");
    expect(sEarly).toBeGreaterThan(sLate);
  });
});
