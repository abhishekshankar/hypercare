import {
  countStageV1Answered,
  isStageV1Answered,
  type StageV1Answers,
} from "./v1-types.js";

/**
 * TASK-034 v1 inference (ADR 0023). Ordinals replace yes/no; behaviorally additive vs v0.
 *
 * Late: same structure as ADR 0005 — at least two “late triggers” among recognition / bathing /
 * conversation / wandering, **and** alone-safety shows they should not be left unsupervised.
 *
 * Middle: any material day-to-day concern (meds not fully independent, ADL help, alone-safety
 * worries, any wandering frequency, sleep disruption).
 *
 * Early: not late, not middle, and at least 5 of 8 questions answered (same minimum as v0).
 */
export function inferStageV1(a: StageV1Answers): "early" | "middle" | "late" | null {
  if (countStageV1Answered(a) < 5) {
    return null;
  }

  const aloneUnsafe = isAloneUnsafe(a.aloneSafetyV1);

  const lateRecognition = a.recognitionV1 === "rarely";
  const lateBathing = a.bathingDressingV1 === "hands_on_help";
  const lateConversation = a.conversationV1 === "rarely_makes_sense";
  const lateWandering =
    a.wanderingV1 === "once" || a.wanderingV1 === "few_times" || a.wanderingV1 === "often";

  let lateTriggers = 0;
  if (lateRecognition) lateTriggers += 1;
  if (lateBathing) lateTriggers += 1;
  if (lateConversation) lateTriggers += 1;
  if (lateWandering) lateTriggers += 1;

  const isLate = lateTriggers >= 2 && aloneUnsafe;
  if (isLate) {
    return "late";
  }

  const middleAny =
    a.medManagementV1 === "reminders" ||
    a.medManagementV1 === "hands_on_help" ||
    a.bathingDressingV1 === "with_reminders" ||
    a.bathingDressingV1 === "hands_on_help" ||
    aloneUnsafe ||
    a.wanderingV1 === "once" ||
    a.wanderingV1 === "few_times" ||
    a.wanderingV1 === "often" ||
    a.conversationV1 === "only_short" ||
    a.sleepV1 === "some_nights_hard" ||
    a.sleepV1 === "most_nights_hard";

  if (middleAny) {
    return "middle";
  }

  if (!isStageV1Answered(a)) {
    return null;
  }

  return "early";
}

/** “Left alone” equivalent: only the `nothing` chip means no active safety worries. */
export function isAloneUnsafe(alone: string[] | null | undefined): boolean {
  if (alone == null || alone.length === 0) {
    return true;
  }
  if (alone.includes("nothing") && alone.length === 1) {
    return false;
  }
  return true;
}
