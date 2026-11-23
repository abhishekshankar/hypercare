import type { LibrarySearchCandidate } from "./library-search-types.js";
import { librarySubstringMatchScore, normalizeLibrarySearchQuery } from "./library-search-score.js";

export type RankedLibrarySearchRow = LibrarySearchCandidate & { score: number };

export function rankLibrarySearchMatches(
  candidates: readonly LibrarySearchCandidate[],
  query: string,
): RankedLibrarySearchRow[] {
  const q = normalizeLibrarySearchQuery(query);
  if (q.length === 0) {
    return [];
  }
  const scored: RankedLibrarySearchRow[] = [];
  for (const c of candidates) {
    const score = librarySubstringMatchScore(c.haystack, q);
    if (score <= 0) {
      continue;
    }
    scored.push({ ...c, score });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.id.localeCompare(b.id);
  });
  return scored;
}
