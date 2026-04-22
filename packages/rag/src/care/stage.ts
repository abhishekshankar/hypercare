/**
 * Re-exports v0 stage keys + inference from `@hypercare/content` (single source, TASK-034).
 */
export {
  STAGE_ANSWER_KEYS,
  type StageAnswerKey,
  type StageAnswersRecord,
  type StageAnswerValue,
  inferStageV0 as inferStage,
} from "@hypercare/content/stage-rules";
