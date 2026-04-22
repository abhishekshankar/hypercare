/**
 * Map free-text "hardest thing" to a v0 `topics.slug` (TASK-024 step 1).
 * Longer / more specific patterns first.
 */
const RULES: ReadonlyArray<{ test: (s: string) => boolean; slug: string }> = [
  { test: (s) => s.includes("guilt"), slug: "guilt-and-grief" },
  { test: (s) => s.includes("sundowning") || s.includes("sundown"), slug: "sundowning" },
  { test: (s) => s.includes("bath") || s.includes("showering"), slug: "bathing-resistance" },
  { test: (s) => s.includes("burnout") || s.includes("exhausted") || s.includes("tired all"),
    slug: "caregiver-burnout" },
  { test: (s) => s.includes("sleep") || s.includes("insomnia"), slug: "sleep-problems" },
  { test: (s) => s.includes("wander"), slug: "wandering" },
  { test: (s) => s.includes("agitat") || s.includes("anger"), slug: "agitation-aggression" },
];

export function mapHardestTextToTopicSlug(text: string): string | null {
  const s = text.trim().toLowerCase();
  if (s.length === 0) {
    return null;
  }
  for (const r of RULES) {
    if (r.test(s)) {
      return r.slug;
    }
  }
  return null;
}
