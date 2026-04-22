/**
 * @hypercare/eval — golden-set eval harness (TASK-012).
 * CLI: `pnpm --filter @hypercare/eval start -- <retrieval|safety|answers|all>` (`run eval` = same; see ADR 0011)
 */
export { DEFAULT_RECALL_AT_K, REGRESSION_PP_THRESHOLD, answerModelIdFromEnv } from "./config.js";
export { runRetrievalEval } from "./runners/retrieval.js";
export { runSafetyEval } from "./runners/safety.js";
export { runAnswersEval } from "./runners/answers.js";
export { writeJsonReport, checkRegression } from "./report.js";
export type * from "./types.js";
