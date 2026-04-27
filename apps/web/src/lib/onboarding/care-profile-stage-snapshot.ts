import type { CareProfileStageSnapshot } from "@alongside/content/stage-rules";

import type { CareProfileRow } from "@/lib/onboarding/status";

export function careProfileToStageSnapshot(row: CareProfileRow): CareProfileStageSnapshot {
  return {
    stageQuestionsVersion: row.stageQuestionsVersion,
    stageAnswers: row.stageAnswers,
    medManagementV1: row.medManagementV1,
    drivingV1: row.drivingV1,
    aloneSafetyV1: row.aloneSafetyV1,
    recognitionV1: row.recognitionV1,
    bathingDressingV1: row.bathingDressingV1,
    wanderingV1: row.wanderingV1,
    conversationV1: row.conversationV1,
    sleepV1: row.sleepV1,
  } as CareProfileStageSnapshot;
}
