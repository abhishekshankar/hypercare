/**
 * Re-exports deterministic offline embedding used when `EVAL_LIVE` is unset.
 * Full Bedrock is wired via `buildDefaultDeps` from `@alongside/rag` in live mode.
 */
export { deterministicEmbedding } from "./embedding.js";
