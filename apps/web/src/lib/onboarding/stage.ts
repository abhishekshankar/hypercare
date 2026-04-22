import { STAGE_ANSWER_KEYS, type StageAnswersRecord, type StageAnswerValue } from "./stage-keys";

function val(r: StageAnswersRecord, k: (typeof STAGE_ANSWER_KEYS)[number]): StageAnswerValue | null | undefined {
  return r[k];
}

function countAnswered(r: StageAnswersRecord): number {
  let n = 0;
  for (const k of STAGE_ANSWER_KEYS) {
    const v = r[k];
    if (v === "yes" || v === "no" || v === "unsure") {
      n += 1;
    }
  }
  return n;
}

/**
 * v1 rules — may be revised by Care Specialist (TASK-007).
 *
 * Late if two or more of {recognizes_you=no, bathes_alone=no, conversations=no, wandering_incidents=yes}
 * and left_alone === "no".
 *
 * Middle if any of {manages_meds=no, bathes_alone=no, left_alone=no, wandering_incidents=yes, sleeps_through_night=no}
 * and late does not apply.
 *
 * Early if not late, not middle, and at least 5 of 8 questions answered; otherwise null.
 */
export function inferStage(answers: StageAnswersRecord): "early" | "middle" | "late" | null {
  if (countAnswered(answers) < 5) {
    return null;
  }

  const recognizesNo = val(answers, "recognizes_you") === "no";
  const bathesNo = val(answers, "bathes_alone") === "no";
  const conversationsNo = val(answers, "conversations") === "no";
  const wanderingYes = val(answers, "wandering_incidents") === "yes";
  const leftAloneNo = val(answers, "left_alone") === "no";

  let lateTriggers = 0;
  if (recognizesNo) lateTriggers += 1;
  if (bathesNo) lateTriggers += 1;
  if (conversationsNo) lateTriggers += 1;
  if (wanderingYes) lateTriggers += 1;

  const isLate = lateTriggers >= 2 && leftAloneNo;

  if (isLate) {
    return "late";
  }

  const middleAny =
    val(answers, "manages_meds") === "no" ||
    bathesNo ||
    leftAloneNo ||
    wanderingYes ||
    val(answers, "sleeps_through_night") === "no";

  if (middleAny) {
    return "middle";
  }

  return "early";
}
