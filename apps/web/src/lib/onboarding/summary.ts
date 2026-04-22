import { isAloneUnsafe } from "@hypercare/content/stage-rules";

import type { CareProfileRow } from "./status";
import type { StageAnswersRecord } from "./stage-keys";

export type SummaryFromProfile = {
  displayName: string;
  profile: CareProfileRow;
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

/** v0 (yes/no) — observed behaviors, never "early/middle/late". */
function observedBehaviorsV0(a: StageAnswersRecord): string[] {
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

function observedBehaviorsV1(crFirst: string, profile: CareProfileRow): string[] {
  const n = crFirst.trim() || "They";
  const bits: string[] = [];
  const m = profile.medManagementV1;
  if (m === "reminders") {
    bits.push(`${n} needs reminders for medications`);
  } else if (m === "hands_on_help") {
    bits.push(`${n} needs hands-on help with medications`);
  }
  const dr = profile.drivingV1;
  if (dr === "never_drove" || dr === "stopped_long_ago" || dr === "stopped_recent") {
    bits.push(`${n} no longer drives`);
  } else if (dr === "worried") {
    bits.push(`you’re worried about ${n}’s driving`);
  }
  if (isAloneUnsafe(profile.aloneSafetyV1)) {
    bits.push(`you’d worry if ${n} were left alone for a few hours`);
  }
  const rec = profile.recognitionV1;
  if (rec === "rarely" || rec === "sometimes") {
    bits.push(`recognition can be inconsistent`);
  }
  const b = profile.bathingDressingV1;
  if (b === "hands_on_help") {
    bits.push(`needs help with bathing and dressing`);
  } else if (b === "with_reminders") {
    bits.push(`needs reminders or cueing for bathing and dressing`);
  }
  const w = profile.wanderingV1;
  if (w === "once" || w === "few_times" || w === "often") {
    bits.push(`wandering or getting lost has come up in the last year`);
  }
  const c = profile.conversationV1;
  if (c === "rarely_makes_sense" || c === "only_short") {
    bits.push(`back-and-forth conversation is hard`);
  } else if (c === "yes_repeats") {
    bits.push(`conversations can loop or repeat`);
  }
  if (profile.sleepV1 === "most_nights_hard" || profile.sleepV1 === "some_nights_hard") {
    bits.push(`nights are often hard`);
  }
  return bits;
}

/**
 * One warm paragraph read-back (PRD §6.2). Template, not LLM output.
 */
export function composeOnboardingSummary(input: SummaryFromProfile): string {
  const name = input.displayName.trim();
  const cr = input.profile.crFirstName.trim();
  const n = cr || "them";
  const rel = RELATIONSHIP_PHRASE[input.profile.crRelationship] ?? "loved one";

  const age =
    input.profile.crAge != null && input.profile.crAge >= 0 && input.profile.crAge <= 120
      ? input.profile.crAge
      : null;
  const ageBit = age != null ? `, ${age}` : "";

  let diagnosisBit = "";
  if (input.profile.crDiagnosis != null && input.profile.crDiagnosis.length > 0) {
    const label = DIAGNOSIS_LABEL[input.profile.crDiagnosis] ?? "dementia";
    const yearBit =
      input.profile.crDiagnosisYear != null ? ` (around ${input.profile.crDiagnosisYear})` : "";
    diagnosisBit = ` who has ${label}${yearBit}`;
  }

  let livingBit = "";
  if (input.profile.livingSituation != null && LIVING_PHRASE[input.profile.livingSituation]) {
    livingBit = ` and ${LIVING_PHRASE[input.profile.livingSituation]}`;
  }

  let proximityBit = "";
  if (
    input.profile.caregiverProximity != null &&
    PROXIMITY_PHRASE[input.profile.caregiverProximity]
  ) {
    proximityBit = ` ${PROXIMITY_PHRASE[input.profile.caregiverProximity]}`;
  }

  const v0 = (input.profile.stageAnswers ?? {}) as StageAnswersRecord;
  const observed =
    (input.profile.stageQuestionsVersion ?? 0) >= 1
      ? observedBehaviorsV1(n, input.profile)
      : observedBehaviorsV0(v0);
  const observedBit =
    observed.length > 0
      ? ` You mentioned ${observed.slice(0, 3).join("; ")}${observed.length > 3 ? "; and more" : ""}.`
      : "";

  const hardest = input.profile.hardestThing?.trim();
  const close =
    hardest != null && hardest.length > 0
      ? ` The hardest thing right now is ${hardest}. Let's start there.`
      : " Let's get started.";

  return `Okay. ${name}, you're caring for your ${rel} ${cr}${ageBit}${diagnosisBit}${livingBit}.${proximityBit}${observedBit}${close}`;
}
