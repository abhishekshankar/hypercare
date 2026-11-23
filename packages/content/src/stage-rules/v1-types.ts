/** CHECK-enforced string values for v1 columns (TASK-034). */

export type MedManagementV1 = "self" | "reminders" | "hands_on_help";

export type DrivingV1 = "safe" | "worried" | "stopped_recent" | "stopped_long_ago" | "never_drove";

/** Multi-select: at least one when the question is answered. */
export type AloneSafetyChip =
  | "nothing"
  | "wandering"
  | "falls"
  | "cooking"
  | "medication_mistakes"
  | "other";

export type RecognitionV1 = "yes_always" | "yes_usually" | "sometimes" | "rarely";

export type BathingDressingV1 = "on_own" | "with_reminders" | "hands_on_help";

export type WanderingV1 = "no" | "once" | "few_times" | "often";

export type ConversationV1 = "yes" | "yes_repeats" | "only_short" | "rarely_makes_sense";

export type SleepV1 = "sleep_through" | "some_nights_hard" | "most_nights_hard";

export type StageV1Answers = {
  medManagementV1: MedManagementV1 | null;
  drivingV1: DrivingV1 | null;
  aloneSafetyV1: AloneSafetyChip[] | null;
  recognitionV1: RecognitionV1 | null;
  bathingDressingV1: BathingDressingV1 | null;
  wanderingV1: WanderingV1 | null;
  conversationV1: ConversationV1 | null;
  sleepV1: SleepV1 | null;
};

export function isStageV1Answered(a: StageV1Answers): boolean {
  if (
    a.medManagementV1 == null ||
    a.drivingV1 == null ||
    a.recognitionV1 == null ||
    a.bathingDressingV1 == null ||
    a.wanderingV1 == null ||
    a.conversationV1 == null ||
    a.sleepV1 == null
  ) {
    return false;
  }
  const al = a.aloneSafetyV1;
  return al != null && al.length > 0;
}

export function countStageV1Answered(a: StageV1Answers): number {
  let n = 0;
  if (a.medManagementV1 != null) n += 1;
  if (a.drivingV1 != null) n += 1;
  if (a.aloneSafetyV1 != null && a.aloneSafetyV1.length > 0) n += 1;
  if (a.recognitionV1 != null) n += 1;
  if (a.bathingDressingV1 != null) n += 1;
  if (a.wanderingV1 != null) n += 1;
  if (a.conversationV1 != null) n += 1;
  if (a.sleepV1 != null) n += 1;
  return n;
}
