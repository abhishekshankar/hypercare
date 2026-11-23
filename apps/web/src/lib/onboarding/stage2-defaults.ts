import { mapStageAnswersV0ToV1, type StageV1Answers } from "@alongside/content/stage-rules";

import type { CareProfileRow } from "@/lib/onboarding/status";
import type { StageAnswersRecord } from "@/lib/onboarding/stage-keys";
import type { StageV1FormDefaults } from "@/lib/onboarding/questions-v1";

function v1answersToFormDefaults(m: StageV1Answers): StageV1FormDefaults {
  return {
    med_management_v1: m.medManagementV1,
    driving_v1: m.drivingV1,
    alone_safety_v1: m.aloneSafetyV1,
    recognition_v1: m.recognitionV1,
    bathing_dressing_v1: m.bathingDressingV1,
    wandering_v1: m.wanderingV1,
    conversation_v1: m.conversationV1,
    sleep_v1: m.sleepV1,
  };
}

/**
 * v1 UI defaults: either stored v1 columns, or legacy `stage_answers` mapped once (TASK-034).
 */
export function getStage2DefaultsForProfile(profile: CareProfileRow | null): StageV1FormDefaults {
  if (profile == null) {
    return {
      med_management_v1: null,
      driving_v1: null,
      alone_safety_v1: null,
      recognition_v1: null,
      bathing_dressing_v1: null,
      wandering_v1: null,
      conversation_v1: null,
      sleep_v1: null,
    };
  }
  if ((profile.stageQuestionsVersion ?? 0) >= 1) {
    return v1answersToFormDefaults({
      medManagementV1: profile.medManagementV1,
      drivingV1: profile.drivingV1,
      aloneSafetyV1: profile.aloneSafetyV1,
      recognitionV1: profile.recognitionV1,
      bathingDressingV1: profile.bathingDressingV1,
      wanderingV1: profile.wanderingV1,
      conversationV1: profile.conversationV1,
      sleepV1: profile.sleepV1,
    } as StageV1Answers) as StageV1FormDefaults;
  }
  return v1answersToFormDefaults(
    mapStageAnswersV0ToV1((profile.stageAnswers ?? {}) as StageAnswersRecord),
  ) as StageV1FormDefaults;
}
