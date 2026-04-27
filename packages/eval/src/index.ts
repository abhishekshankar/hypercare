/**
 * @alongside/eval — golden-set eval harness (TASK-012).
 * CLI: `pnpm --filter @alongside/eval start -- <retrieval|safety|answers|redteam|all>` (`run eval` = same; see ADR 0011, red-team: ADR 0016)
 */
export { DEFAULT_RECALL_AT_K, REGRESSION_PP_THRESHOLD, answerModelIdFromEnv } from "./config.js";
export { runRetrievalEval } from "./runners/retrieval.js";
export { runSafetyEval } from "./runners/safety.js";
export { runAnswersEval } from "./runners/answers.js";
export { runRedteamEval, runRedteamExport } from "./runners/redteam.js";
export { writeJsonReport, checkRegression } from "./report.js";
export type * from "./types.js";
