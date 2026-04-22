export { classify, buildDefaultDeps, runAllRules, aggregateRuleHits } from "./classify.js";
export type { ClassifyDeps } from "./classify.js";
export {
  categoryToSeverity,
  categoryToSuggestedAction,
  SAFETY_CATEGORIES,
  SAFETY_CLASSIFIER_CATEGORIES,
} from "./types.js";
export type {
  SafetyClassifierCategory,
  SafetyCategory,
  SafetyInput,
  SafetyResult,
  SafetyRule,
  SafetySeverity,
  SafetySource,
  SuggestedAction,
} from "./types.js";
export { makeDbPersist } from "./persist.js";
export type { PersistFn, PersistInput, PersistOutcome, SafetyDb } from "./persist.js";
export {
  parseEscalationFile,
  parseEscalationMarkdown,
  getScriptPathForCategory,
  readScriptVersionOnly,
  resolveScriptFilename,
} from "./scripts/parse.js";
export type { EscalationResource, ParsedEscalationScript } from "./scripts/parse.js";
export {
  CLASSIFIER_MAX_TOKENS,
  CLASSIFIER_MODEL_ID,
  CLASSIFIER_REGION,
  CLASSIFIER_TEMPERATURE,
  SAFETY_FT_MODEL_ID,
} from "./config.js";
export type { SafetyLayerBClassifier } from "./config.js";
export { classifyWithLlm, parseLlmJson, defaultInvoke, defaultInvokeFineTuned } from "./llm/classifier.js";
export type { ClassifyLlmDeps, LlmClassification } from "./llm/classifier.js";
export { makeFtShadowLogger, llmVerdictToJson } from "./shadow-log.js";
export type { FtShadowLogFn, FtShadowLogInput } from "./shadow-log.js";
