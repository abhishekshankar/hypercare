/**
 * Layer 2 — Retrieve.
 *
 * 1. Embed the (PII-scrubbed) question with the same Titan v2 model the
 *    content pipeline uses at ingest. Same model is non-negotiable; cosine
 *    distance between embeddings from different models is meaningless.
 * 2. Run a pgvector ANN search filtered by the user's inferred stage.
 * 3. Return hits already sorted by ascending cosine distance.
 *
 * Pure dependency-injected layer: tests pass mock `embed` and `search` fns.
 */

import { EMBED_DIMS } from "../config.js";
import type { RetrievedChunk, Stage } from "../types.js";

export type RetrieveInput = {
  scrubbedQuestion: string;
  stage: Stage | null;
  relationship: string | null;
  livingSituation: string | null;
  k: number;
};

export type RetrieveDeps = {
  embed: (text: string) => Promise<number[]>;
  search: (q: {
    embedding: number[];
    stage: Stage | null;
    relationship: string | null;
    livingSituation: string | null;
    k: number;
  }) => Promise<RetrievedChunk[]>;
};

export type RetrieveOutput = {
  hits: RetrievedChunk[];
  embedDims: number;
};

export async function retrieve(
  input: RetrieveInput,
  deps: RetrieveDeps,
): Promise<RetrieveOutput> {
  if (!input.scrubbedQuestion) {
    return { hits: [], embedDims: 0 };
  }
  const embedding = await deps.embed(input.scrubbedQuestion);
  if (!Array.isArray(embedding) || embedding.length !== EMBED_DIMS) {
    throw new Error(
      `retrieve: expected ${String(EMBED_DIMS)}-d embedding, got ${
        Array.isArray(embedding) ? embedding.length : "non-array"
      }`,
    );
  }
  const hits = await deps.search({
    embedding,
    stage: input.stage,
    relationship: input.relationship,
    livingSituation: input.livingSituation,
    k: input.k,
  });
  // Defense-in-depth: caller may not have ordered. Sort ascending by distance.
  const sorted = [...hits].sort((a, b) => a.distance - b.distance);
  return { hits: sorted, embedDims: embedding.length };
}
