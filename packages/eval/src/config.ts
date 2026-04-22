/**
 * Eval harness config (TASK-012). Tweak the regression window here, not in runners.
 */
/** Percentage points — compare vs `git show HEAD:.../latest.json` after each run. */
export const REGRESSION_PP_THRESHOLD = 5;

/** Layer-2 / report recall: first K chunk hits (by ascending distance) considered. */
export const DEFAULT_RECALL_AT_K = 5;

/** Model id string copied into answer reports (visibility for HAiku vs Sonnet trend tracking). */
export function answerModelIdFromEnv(): string {
  return process.env.BEDROCK_ANSWER_MODEL_ID?.trim() || "us.anthropic.claude-haiku-4-5-20251001-v1:0";
}
