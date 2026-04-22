import {
  librarySubstringMatchScore,
  normalizeLibrarySearchQuery,
} from "@hypercare/db/library-search-score";

import type { LibraryModuleListItem, StageKey } from "./types";

const STAGES: readonly StageKey[] = ["early", "middle", "late"];

function isStage(s: string): s is StageKey {
  return (STAGES as readonly string[]).includes(s);
}

/** Haystack for substring search: title, summary, topic display names. */
export function searchHaystack(m: LibraryModuleListItem): string {
  const topicNames = m.topicTags.map((t) => t.displayName).join(" ");
  return `${m.title} ${m.summary} ${topicNames}`.toLowerCase();
}

export function matchesSearchQuery(
  m: LibraryModuleListItem,
  query: string,
): boolean {
  const q = normalizeLibrarySearchQuery(query);
  if (q.length === 0) return true;
  return librarySubstringMatchScore(searchHaystack(m), q) > 0;
}

/**
 * @param selected — when empty, no filter (all stages). Otherwise module must
 *   share at least one stage with `selected` (intersection non-empty).
 */
export function matchesStageFilter(
  m: LibraryModuleListItem,
  selected: ReadonlySet<StageKey>,
): boolean {
  if (selected.size === 0) return true;
  for (const s of m.stageRelevance) {
    if (isStage(s) && selected.has(s)) return true;
  }
  return false;
}

export function filterLibraryModules(
  items: readonly LibraryModuleListItem[],
  query: string,
  selectedStages: ReadonlySet<StageKey>,
): LibraryModuleListItem[] {
  return items.filter(
    (m) => matchesSearchQuery(m, query) && matchesStageFilter(m, selectedStages),
  );
}
