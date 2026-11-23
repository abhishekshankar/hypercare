import { createHash } from "node:crypto";

const DIM = 1024; // Titan v2 / packages/rag EMBED_DIMS

/**
 * Deterministic 1024-d embedding for offline eval; stable across Node versions for a given `key`.
 */
export function deterministicEmbedding(key: string): number[] {
  const h = createHash("sha256").update(key, "utf8").digest();
  const v: number[] = new Array(DIM);
  for (let i = 0; i < DIM; i++) {
    v[i] = (h[i % 32] ?? 0) / 255 - 0.5;
  }
  v[0] = 0.1;
  return v;
}
