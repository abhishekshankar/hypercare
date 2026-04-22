import { mapStageAnswersV0ToV1 } from "@hypercare/content/stage-rules";

import type { CareProfileRow } from "@/lib/onboarding/status";
import type { StageAnswersRecord } from "@/lib/onboarding/stage-keys";
import { getStage2DefaultsForProfile } from "@/lib/onboarding/stage2-defaults";

import type { Step1Input, Step2Input, Step3Input, Step4Input, Step5Input } from "@/lib/onboarding/schemas";

export function rowToAboutCrSnapshot(row: CareProfileRow): Record<string, unknown> {
  return {
    cr_first_name: row.crFirstName,
    cr_age: row.crAge ?? undefined,
    cr_relationship: row.crRelationship,
    cr_diagnosis: row.crDiagnosis,
    cr_diagnosis_year: row.crDiagnosisYear ?? undefined,
  } satisfies Record<string, unknown>;
}

/**
 * Snapshots the stage section in v1 form keys so diffs are stable across v0 → v1 migration.
 */
export function rowToStageSnapshot(row: CareProfileRow): Record<string, unknown> {
  if ((row.stageQuestionsVersion ?? 0) >= 1) {
    return { ...getStage2DefaultsForProfile(row) } as Record<string, unknown>;
  }
  return {
    ...v1FormDefaultsFromV0Answers((row.stageAnswers ?? {}) as StageAnswersRecord),
  } as Record<string, unknown>;
}

function v1FormDefaultsFromV0Answers(answers: StageAnswersRecord): Record<string, unknown> {
  const m = mapStageAnswersV0ToV1(answers);
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

export function rowToLivingSnapshot(row: CareProfileRow): Record<string, unknown> {
  return {
    living_situation: row.livingSituation ?? undefined,
    care_network: row.careNetwork ?? undefined,
    care_hours_per_week: row.careHoursPerWeek ?? undefined,
    caregiver_proximity: row.caregiverProximity ?? undefined,
  };
}

export function rowToAboutYouSnapshot(row: CareProfileRow, displayName: string | null): Record<string, unknown> {
  return {
    display_name: displayName ?? "",
    caregiver_age_bracket: row.caregiverAgeBracket ?? undefined,
    caregiver_work_status: row.caregiverWorkStatus ?? undefined,
    caregiver_state_1_5: row.caregiverState1_5 ?? undefined,
    hardest_thing: row.hardestThing ?? undefined,
  };
}

export function rowToWhatMattersSnapshot(row: CareProfileRow): Record<string, unknown> {
  return {
    cr_background: row.crBackground ?? "",
    cr_joy: row.crJoy ?? "",
    cr_personality_notes: row.crPersonalityNotes ?? "",
  };
}

export function step1ToCareProfileUpdate(d: Step1Input) {
  return {
    crFirstName: d.cr_first_name,
    crAge: d.cr_age ?? null,
    crRelationship: d.cr_relationship,
    crDiagnosis: d.cr_diagnosis,
    crDiagnosisYear: d.cr_diagnosis_year ?? null,
  };
}

export function step3ToCareProfileUpdate(d: Step3Input) {
  return {
    livingSituation: d.living_situation,
    careNetwork: d.care_network,
    careHoursPerWeek: d.care_hours_per_week ?? null,
    caregiverProximity: d.caregiver_proximity,
  };
}

export function step4ToCareProfileUpdate(d: Step4Input) {
  return {
    caregiverAgeBracket: d.caregiver_age_bracket,
    caregiverWorkStatus: d.caregiver_work_status,
    caregiverState1_5: d.caregiver_state_1_5,
    hardestThing: d.hardest_thing,
  };
}

export function step5ToCareProfileUpdate(d: Step5Input) {
  return {
    crBackground: d.cr_background,
    crJoy: d.cr_joy,
    crPersonalityNotes: d.cr_personality_notes,
  };
}

export function step2V1ToCareProfileUpdate(
  d: Step2Input,
  inferred: string | null,
): {
  medManagementV1: string;
  drivingV1: string;
  aloneSafetyV1: string[];
  recognitionV1: string;
  bathingDressingV1: string;
  wanderingV1: string;
  conversationV1: string;
  sleepV1: string;
  stageQuestionsVersion: number;
  stageAnswers: Record<string, never>;
  inferredStage: string | null;
} {
  return {
    medManagementV1: d.med_management_v1,
    drivingV1: d.driving_v1,
    aloneSafetyV1: d.alone_safety_v1,
    recognitionV1: d.recognition_v1,
    bathingDressingV1: d.bathing_dressing_v1,
    wanderingV1: d.wandering_v1,
    conversationV1: d.conversation_v1,
    sleepV1: d.sleep_v1,
    stageQuestionsVersion: 1,
    stageAnswers: {},
    inferredStage: inferred,
  };
}

