import type { RagConfig } from "../config.js";

/**
 * Optional expansion of the retrieval query using conversation memory (v0: no-op when disabled).
 * TASK-027 — default off; enable with `rewriteQueryWithMemory` in config after evals.
 */
export function rewriteQueryWithMemory(
  scrubbedQuestion: string,
  _memoryMarkdown: string | null | undefined,
  config: RagConfig,
): string {
  if (!config.rewriteQueryWithMemory) return scrubbedQuestion;
  if (!_memoryMarkdown?.trim()) return scrubbedQuestion;
  return scrubbedQuestion;
}
