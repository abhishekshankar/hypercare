import type { CareProfileRow } from "@/lib/onboarding/status";
import { STAGE_ANSWER_KEYS, type StageAnswersRecord } from "@/lib/onboarding/stage-keys";

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

export function rowToStageSnapshot(row: CareProfileRow): Record<string, unknown> {
  const a = (row.stageAnswers ?? {}) as StageAnswersRecord;
  const o: Record<string, unknown> = {};
  for (const k of STAGE_ANSWER_KEYS) {
    o[k] = a[k] ?? null;
  }
  return o;
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

export function step2ToStageAnswers(d: Step2Input): StageAnswersRecord {
  return d as StageAnswersRecord;
}
