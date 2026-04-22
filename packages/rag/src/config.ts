/**
 * Tunable v0 retrieval / generation knobs. TASK-012 will harden these via evals.
 * Importable as named exports so the eval harness can override them per-run.
 */

/** Number of chunks fetched from pgvector before grounding decision. */
export const RETRIEVAL_K = 6;

/** Number of chunks layer 4 forwards to the model. <= RETRIEVAL_K. */
export const MAX_CHUNKS_FOR_PROMPT = 4;

/** Top-1 cosine distance must be at or below this for the answer path to proceed. */
export const TOP1_DISTANCE_THRESHOLD = 0.4;

/** At least N hits must be at or below the secondary threshold (cosine distance). */
export const SECONDARY_DISTANCE_THRESHOLD = 0.6;
export const SECONDARY_MIN_HITS = 3;

/** Embedding contract — Titan v2 returns 1024 dims (ADR 0006). */
export const EMBED_DIMS = 1024;

/**
 * Bedrock answering model: Claude Haiku 4.5 via **system inference profile** (not raw model id).
 * In many accounts, `anthropic.*` on-demand is rejected; `us.*` (Americas) works for `ca-central-1`.
 * Override with `BEDROCK_ANSWER_MODEL_ID` or `withConfig({ answerModelId })` if your account only exposes `global.*` or a custom application profile.
 */
export const ANSWER_MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
export const ANSWER_REGION = "ca-central-1";
export const ANSWER_MAX_TOKENS = 600;
export const ANSWER_TEMPERATURE = 0.2;

/**
 * Conversation memory refresh cadence: refresh after every N user turns, and
 * immediately after a care-profile change (invalidation bit).
 * TASK-027.
 */
export const MEMORY_REFRESH_EVERY_N = 3;
/** Enforced on `summary_md` at refresh time (rough token count). */
export const MEMORY_MAX_TOKENS = 400;
/** Haiku for rolling summaries (cost envelope). */
export const MEMORY_MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
export const MEMORY_MODEL_REGION = ANSWER_REGION;
/**
 * If true, expand retrieval query with memory before embedding (v0: off; ship prompt-only first).
 * TASK-027.
 */
export const REWRITE_QUERY_WITH_MEMORY = false;

/** All knobs in one shape so callers can override piecewise. */
export type RagConfig = {
  retrievalK: number;
  maxChunksForPrompt: number;
  top1DistanceThreshold: number;
  secondaryDistanceThreshold: number;
  secondaryMinHits: number;
  embedDims: number;
  answerModelId: string;
  answerRegion: string;
  answerMaxTokens: number;
  answerTemperature: number;
  memoryRefreshEveryN: number;
  memoryMaxTokens: number;
  rewriteQueryWithMemory: boolean;
};

export const DEFAULT_CONFIG: Readonly<RagConfig> = Object.freeze({
  retrievalK: RETRIEVAL_K,
  maxChunksForPrompt: MAX_CHUNKS_FOR_PROMPT,
  top1DistanceThreshold: TOP1_DISTANCE_THRESHOLD,
  secondaryDistanceThreshold: SECONDARY_DISTANCE_THRESHOLD,
  secondaryMinHits: SECONDARY_MIN_HITS,
  embedDims: EMBED_DIMS,
  answerModelId: ANSWER_MODEL_ID,
  answerRegion: ANSWER_REGION,
  answerMaxTokens: ANSWER_MAX_TOKENS,
  answerTemperature: ANSWER_TEMPERATURE,
  memoryRefreshEveryN: MEMORY_REFRESH_EVERY_N,
  memoryMaxTokens: MEMORY_MAX_TOKENS,
  rewriteQueryWithMemory: REWRITE_QUERY_WITH_MEMORY,
});

export function withConfig(overrides: Partial<RagConfig> = {}): RagConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
