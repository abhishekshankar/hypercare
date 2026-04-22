/**
 * NOTE: This file mirrors `apps/web/src/lib/onboarding/stage.ts` and
 * `apps/web/src/lib/onboarding/stage-keys.ts`. Keep the rule logic in sync.
 *
 * TODO(extract): When a shared `@hypercare/onboarding` package exists, replace
 * this duplication with a real import. We do not import from `apps/web/*` here
 * because that file uses Next.js's `server-only` and lives outside the package
 * graph that `@hypercare/rag` should depend on.
 */

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

import type { Stage } from "../types.js";

function val(r: StageAnswersRecord, k: StageAnswerKey): StageAnswerValue | null | undefined {
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

export function inferStage(answers: StageAnswersRecord): Stage | null {
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
  if (isLate) return "late";

  const middleAny =
    val(answers, "manages_meds") === "no" ||
    bathesNo ||
    leftAloneNo ||
    wanderingYes ||
    val(answers, "sleeps_through_night") === "no";

  if (middleAny) return "middle";
  return "early";
}
