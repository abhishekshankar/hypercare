/**
 * TASK-041: shared substring scoring for library search (server stream + client fallback).
 * Match semantics: case-insensitive contiguous substring (same as legacy `includes` on haystack).
 * Score orders by first match position (earlier in haystack = higher score).
 */

export function normalizeLibrarySearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * @returns 0 if `queryLower` is empty or not found in `haystackLower`; else positive score (higher = better).
 */
export function librarySubstringMatchScore(haystackLower: string, queryLower: string): number {
  if (queryLower.length === 0) {
    return 0;
  }
  const idx = haystackLower.indexOf(queryLower);
  if (idx < 0) {
    return 0;
  }
  return 1_000_000 - idx;
}
