/**
 * Re-exports v0 stage keys + inference from `@alongside/content` (single source, TASK-034).
 */
export {
  STAGE_ANSWER_KEYS,
  type StageAnswerKey,
  type StageAnswersRecord,
  type StageAnswerValue,
  inferStageV0 as inferStage,
} from "@alongside/content/stage-rules";
