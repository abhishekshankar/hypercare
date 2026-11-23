import type { Citation } from "@alongside/rag";

export function moduleSlugsFromCitations(citations: unknown): string[] {
  if (!Array.isArray(citations)) return [];
  const slugs = new Set<string>();
  for (const c of citations) {
    if (c && typeof c === "object" && "moduleSlug" in c) {
      const s = (c as Citation).moduleSlug;
      if (typeof s === "string" && s.length > 0) slugs.add(s);
    }
  }
  return [...slugs];
}
