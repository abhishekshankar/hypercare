import {
  inferInferredStage,
  inferStageV0,
  inferStageV1,
  type CareProfileStageSnapshot,
} from "@hypercare/content/stage-rules";

import type { StageAnswersRecord } from "./stage-keys";

export { inferInferredStage, inferStageV0, inferStageV1 };

/**
 * @deprecated v0-only. Prefer `inferInferredStage(careProfileToStageSnapshot(row))` for live profile rows.
 */
export function inferStage(answers: StageAnswersRecord) {
  return inferStageV0(answers);
}

export function inferFromStageSnapshot(snapshot: CareProfileStageSnapshot) {
  return inferInferredStage(snapshot);
}
