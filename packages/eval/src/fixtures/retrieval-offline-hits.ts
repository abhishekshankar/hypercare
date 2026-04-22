import type { RetrievedChunk } from "@hypercare/rag";

import { makeRetrievedChunk } from "./chunk.js";

type Mod = "behavior" | "daily" | "self";

function stack(lead: Mod, d0: number, noise: { mod: Mod; d: number; suffix: string }[]): RetrievedChunk[] {
  const a = makeRetrievedChunk(lead, {
    chunkId: `${String(lead)}-a`,
    distance: d0,
    chunkIndex: 0,
    content: "Primary chunk for eval ordering.",
    sectionHeading: "Intro",
  });
  return [
    a,
    ...noise.map((n, i) =>
      makeRetrievedChunk(n.mod, {
        chunkId: `${n.mod}-n-${n.suffix}`,
        distance: n.d,
        chunkIndex: i + 1,
        content: "Noise chunk for top-k mix.",
        sectionHeading: "Context",
      }),
    ),
  ];
}

/**
 * For each golden retrieval case id, the hits layer 2 would see (sorted ascending by distance
 * in the real pipeline; we pre-order accordingly).
 */
export const RETRIEVAL_OFFLINE_HITS: Record<string, RetrievedChunk[]> = (() => {
  const o: Record<string, RetrievedChunk[]> = {};

  for (let i = 1; i <= 10; i++) {
    const id = `r_bs_${String(i).padStart(2, "0")}`;
    o[id] = stack("behavior", 0.1 + i * 0.001, [
      { mod: "behavior", d: 0.15 + i * 0.001, suffix: "b" },
      { mod: "daily", d: 0.45, suffix: "x" },
      { mod: "self", d: 0.55, suffix: "y" },
    ]);
  }
  for (let i = 1; i <= 10; i++) {
    const id = `r_db_${String(i).padStart(2, "0")}`;
    o[id] = stack("daily", 0.11 + i * 0.001, [
      { mod: "daily", d: 0.16 + i * 0.001, suffix: "b" },
      { mod: "behavior", d: 0.46, suffix: "x" },
      { mod: "self", d: 0.56, suffix: "y" },
    ]);
  }
  for (let i = 1; i <= 10; i++) {
    const id = `r_sc_${String(i).padStart(2, "0")}`;
    o[id] = stack("self", 0.12 + i * 0.001, [
      { mod: "self", d: 0.17 + i * 0.001, suffix: "b" },
      { mod: "behavior", d: 0.48, suffix: "x" },
      { mod: "daily", d: 0.57, suffix: "y" },
    ]);
  }

  // Strengthen a couple of negative-signal cases: no self-care in top slugs
  o.r_bs_09 = stack("behavior", 0.09, [
    { mod: "behavior", d: 0.12, suffix: "b" },
    { mod: "daily", d: 0.4, suffix: "x" },
  ]);
  o.r_db_09 = stack("daily", 0.09, [
    { mod: "daily", d: 0.12, suffix: "b" },
    { mod: "behavior", d: 0.42, suffix: "x" },
  ]);

  return o;
})();
