import { inferStageV0, type StageAnswersRecord } from "./v0-infer.js";
import { mapStageAnswersV0ToV1 } from "./legacy-map.js";
import { inferStageV1 } from "./v1-infer.js";
import { isStageV1Answered, type StageV1Answers } from "./v1-types.js";

export type CareProfileStageSnapshot = {
  stageQuestionsVersion: number | null;
  stageAnswers: unknown;
} & StageV1Answers;

function rowToV1(snapshot: CareProfileStageSnapshot): StageV1Answers {
  const v = snapshot.stageQuestionsVersion ?? 0;
  if (v >= 1) {
    return {
      medManagementV1: snapshot.medManagementV1,
      drivingV1: snapshot.drivingV1,
      aloneSafetyV1: snapshot.aloneSafetyV1,
      recognitionV1: snapshot.recognitionV1,
      bathingDressingV1: snapshot.bathingDressingV1,
      wanderingV1: snapshot.wanderingV1,
      conversationV1: snapshot.conversationV1,
      sleepV1: snapshot.sleepV1,
    };
  }
  return mapStageAnswersV0ToV1((snapshot.stageAnswers ?? {}) as StageAnswersRecord);
}

/**
 * Single entry for RAG, picker, and web: uses v1 columns when `stage_questions_version >= 1`,
 * otherwise replays v0 JSON through the legacy map (so in-flight v0 rows still infer during
 * the migration window).
 */
export function inferInferredStage(snapshot: CareProfileStageSnapshot): "early" | "middle" | "late" | null {
  const v = snapshot.stageQuestionsVersion ?? 0;
  if (v >= 1) {
    const a = rowToV1(snapshot);
    if (!isStageV1Answered(a)) {
      return null;
    }
    return inferStageV1(a);
  }
  return inferStageV0((snapshot.stageAnswers ?? {}) as StageAnswersRecord);
}

export { inferStageV0, inferStageV1, mapStageAnswersV0ToV1 };
