/** Stable keys for `care_profile.stage_answers` when `stage_questions_version === 0` (TASK-007). */
export const STAGE_ANSWER_KEYS = [
  "manages_meds",
  "drives",
  "left_alone",
  "recognizes_you",
  "bathes_alone",
  "wandering_incidents",
  "conversations",
  "sleeps_through_night",
] as const;

export type StageAnswerKey = (typeof STAGE_ANSWER_KEYS)[number];

export type StageAnswerValue = "yes" | "no" | "unsure";

export type StageAnswersRecord = Partial<Record<StageAnswerKey, StageAnswerValue | null>>;
