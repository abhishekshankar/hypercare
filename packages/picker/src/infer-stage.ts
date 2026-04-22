import type { PickerStage } from "./types.js";

/** Narrow copy of `care_profile.stage_answers` shape for inferring stage. */
type StageAns = Record<string, "yes" | "no" | "unsure" | null | undefined>;

const KEYS = [
  "manages_meds",
  "drives",
  "left_alone",
  "recognizes_you",
  "bathes_alone",
  "wandering_incidents",
  "conversations",
  "sleeps_through_night",
] as const;

function val(r: StageAns, k: (typeof KEYS)[number]): "yes" | "no" | "unsure" | null | undefined {
  return r[k];
}

function countAnswered(r: StageAns): number {
  let n = 0;
  for (const k of KEYS) {
    const v = r[k];
    if (v === "yes" || v === "no" || v === "unsure") {
      n += 1;
    }
  }
  return n;
}

/** Mirrors `apps/web/src/lib/onboarding/stage.ts` (TASK-007). */
export function inferStageFromAnswers(answers: unknown): PickerStage | null {
  const r = (answers && typeof answers === "object" ? answers : {}) as StageAns;
  if (countAnswered(r) < 5) {
    return null;
  }

  const recognizesNo = val(r, "recognizes_you") === "no";
  const bathesNo = val(r, "bathes_alone") === "no";
  const conversationsNo = val(r, "conversations") === "no";
  const wanderingYes = val(r, "wandering_incidents") === "yes";
  const leftAloneNo = val(r, "left_alone") === "no";

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
    val(r, "manages_meds") === "no" ||
    bathesNo ||
    leftAloneNo ||
    wanderingYes ||
    val(r, "sleeps_through_night") === "no";

  if (middleAny) {
    return "middle";
  }

  return "early";
}
