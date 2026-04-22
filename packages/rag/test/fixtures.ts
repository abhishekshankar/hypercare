import type { RetrievedChunk } from "../src/types.js";

export function makeChunk(
  overrides: Partial<RetrievedChunk> & { distance: number; chunkId?: string },
): RetrievedChunk {
  return {
    chunkId: overrides.chunkId ?? `chunk-${Math.random().toString(36).slice(2, 8)}`,
    moduleId: "00000000-0000-0000-0000-000000000001",
    moduleSlug: "behaviors-sundowning",
    moduleTitle: "Sundowning",
    category: "behaviors",
    attributionLine: "Reviewed by Dr. Example, MD — 2025-09-01",
    sectionHeading: "What is sundowning",
    stageRelevance: ["early", "middle"],
    chunkIndex: 0,
    content:
      "Sundowning is a pattern of late-day agitation. Try a calm routine, dim lights, and avoid caffeine after lunch.",
    ...overrides,
  };
}

/** A 1024-d unit vector — content is irrelevant to layer-2 unit tests. */
export function fakeEmbedding(): number[] {
  return new Array(1024).fill(0).map((_v, i) => (i === 0 ? 1 : 0));
}
