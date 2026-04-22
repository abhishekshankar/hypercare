import type { StageAnswersRecord } from "./stage-keys";

export type SummaryInput = {
  displayName: string;
  crFirstName: string;
  crAge: number | null;
  crRelationship: string;
  crDiagnosis: string | null;
  crDiagnosisYear: number | null;
  livingSituation: string | null;
  caregiverProximity: string | null;
  hardestThing: string | null;
  stageAnswers: StageAnswersRecord;
};

const RELATIONSHIP_PHRASE: Record<string, string> = {
  parent: "parent",
  spouse: "spouse",
  sibling: "sibling",
  in_law: "in-law",
  other: "loved one",
};

const DIAGNOSIS_LABEL: Record<string, string> = {
  alzheimers: "Alzheimer's disease",
  vascular: "vascular dementia",
  lewy_body: "Lewy body dementia",
  frontotemporal: "frontotemporal dementia",
  mixed: "mixed dementia",
  unknown_type: "dementia — type unknown",
  suspected_undiagnosed: "dementia that hasn't been formally diagnosed yet",
};

const LIVING_PHRASE: Record<string, string> = {
  with_caregiver: "lives with you",
  alone: "lives alone",
  with_other_family: "lives with another family member",
  assisted_living: "lives in assisted living",
  memory_care: "lives in memory care",
  nursing_home: "lives in a nursing home",
};

const PROXIMITY_PHRASE: Record<string, string> = {
  same_home: "You're in the same home.",
  same_city: "You're in the same city.",
  remote: "You're caring from a distance.",
};

/** Observed behaviors for read-back (never "early/middle/late"). */
function observedBehaviors(a: StageAnswersRecord): string[] {
  const bits: string[] = [];
  if (a.bathes_alone === "no") {
    bits.push("needs help with bathing and dressing");
  }
  if (a.wandering_incidents === "yes") {
    bits.push("sometimes wanders or gets lost");
  }
  if (a.recognizes_you === "no") {
    bits.push("doesn't always recognize you");
  }
  if (a.conversations === "no") {
    bits.push("conversations are often hard to follow");
  }
  if (a.left_alone === "no") {
    bits.push("shouldn't be left alone for long");
  }
  if (a.manages_meds === "no") {
    bits.push("needs help with medications");
  }
  if (a.sleeps_through_night === "no") {
    bits.push("doesn't always sleep through the night");
  }
  if (a.drives === "no") {
    bits.push("no longer drives");
  }
  return bits;
}

/**
 * One warm paragraph read-back (PRD §6.2). Template, not LLM output.
 */
export function composeOnboardingSummary(input: SummaryInput): string {
  const name = input.displayName.trim();
  const cr = input.crFirstName.trim();
  const rel = RELATIONSHIP_PHRASE[input.crRelationship] ?? "loved one";

  const ageBit =
    input.crAge != null && input.crAge >= 0 && input.crAge <= 120 ? `, ${input.crAge}` : "";

  let diagnosisBit = "";
  if (input.crDiagnosis != null && input.crDiagnosis.length > 0) {
    const label = DIAGNOSIS_LABEL[input.crDiagnosis] ?? "dementia";
    const yearBit =
      input.crDiagnosisYear != null ? ` (around ${input.crDiagnosisYear})` : "";
    diagnosisBit = ` who has ${label}${yearBit}`;
  }

  let livingBit = "";
  if (input.livingSituation != null && LIVING_PHRASE[input.livingSituation]) {
    livingBit = ` and ${LIVING_PHRASE[input.livingSituation]}`;
  }

  let proximityBit = "";
  if (input.caregiverProximity != null && PROXIMITY_PHRASE[input.caregiverProximity]) {
    proximityBit = ` ${PROXIMITY_PHRASE[input.caregiverProximity]}`;
  }

  const observed = observedBehaviors(input.stageAnswers);
  const observedBit =
    observed.length > 0
      ? ` You mentioned ${observed.slice(0, 3).join("; ")}${observed.length > 3 ? "; and more" : ""}.`
      : "";

  const hardest = input.hardestThing?.trim();
  const close =
    hardest != null && hardest.length > 0
      ? ` The hardest thing right now is ${hardest}. Let's start there.`
      : " Let's get started.";

  return `Okay. ${name}, you're caring for your ${rel} ${cr}${ageBit}${diagnosisBit}${livingBit}.${proximityBit}${observedBit}${close}`;
}
