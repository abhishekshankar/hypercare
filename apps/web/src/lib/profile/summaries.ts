import { countStageV1Answered, type StageV1Answers } from "@hypercare/content/stage-rules";

import { aboutCrOneLiner } from "@/lib/profile/change-copy";
import { STAGE_ANSWER_KEYS, type StageAnswersRecord } from "@/lib/onboarding/stage-keys";
import type { CareProfileRow } from "@/lib/onboarding/status";

function countStageSignals(profile: CareProfileRow): number {
  if ((profile.stageQuestionsVersion ?? 0) >= 1) {
    return countStageV1Answered({
      medManagementV1: profile.medManagementV1,
      drivingV1: profile.drivingV1,
      aloneSafetyV1: profile.aloneSafetyV1,
      recognitionV1: profile.recognitionV1,
      bathingDressingV1: profile.bathingDressingV1,
      wanderingV1: profile.wanderingV1,
      conversationV1: profile.conversationV1,
      sleepV1: profile.sleepV1,
    } as StageV1Answers);
  }
  const answers = profile.stageAnswers;
  if (answers == null || typeof answers !== "object") {
    return 0;
  }
  const o = answers as StageAnswersRecord;
  let n = 0;
  for (const k of STAGE_ANSWER_KEYS) {
    const v = o[k];
    if (v === "yes" || v === "no" || v === "unsure") {
      n += 1;
    }
  }
  return n;
}

const LIVING: Record<string, string> = {
  with_caregiver: "Lives with you",
  alone: "Lives alone",
  with_other_family: "Lives with other family",
  assisted_living: "Assisted living",
  memory_care: "Memory care",
  nursing_home: "Nursing home",
};

const NET: Record<string, string> = {
  solo: "mostly you",
  siblings_helping: "siblings help",
  paid_help: "paid help",
  spouse_of_cr: "spouse involved",
};

const PROX: Record<string, string> = {
  same_home: "same home as you",
  same_city: "same city as you",
  remote: "long distance",
};

export function profileSectionSummaries(profile: CareProfileRow) {
  const n = countStageSignals(profile);
  const firstName = profile.crFirstName?.trim() || "Them";
  return {
    about: aboutCrOneLiner({
      firstName: profile.crFirstName,
      age: profile.crAge,
      diagnosis: profile.crDiagnosis,
      diagnosisYear: profile.crDiagnosisYear,
    }),
    stage: `Day-to-day details saved (${n} of 8)`,
    living: (() => {
      const p = [profile.livingSituation, profile.careNetwork, profile.caregiverProximity]
        .map((k, i) => {
          if (k == null) {
            return null;
          }
          if (i === 0) {
            return LIVING[k] ?? k;
          }
          if (i === 1) {
            return NET[k] ?? k;
          }
          return PROX[k] ?? k;
        })
        .filter(Boolean);
      return p.length > 0 ? p.join(" · ") : "Add living details";
    })(),
    aboutYou: "Your caregiving & wellbeing inputs",
    whatMatters: (() => {
      const t = (profile.crBackground ?? "").trim();
      if (t.length > 0) {
        return t.length > 80 ? `${t.slice(0, 80).trimEnd()}…` : t;
      }
      return `What matters to ${firstName} — add notes any time`;
    })(),
  };
}

export function fullSectionDetail(
  key: "about" | "stage" | "living" | "aboutYou" | "whatMatters",
  profile: CareProfileRow,
  displayName: string,
): string {
  const firstName = profile.crFirstName?.trim() || "Them";
  if (key === "about") {
    return [aboutCrOneLiner({
      firstName: profile.crFirstName,
      age: profile.crAge,
      diagnosis: profile.crDiagnosis,
      diagnosisYear: profile.crDiagnosisYear,
    })]
      .filter(Boolean)
      .join(" ");
  }
  if (key === "stage") {
    return `Eight day-to-day questions (medications, safety, sleep, and more) shape which lessons we suggest for ${firstName}. Tap Edit to update your answers.`;
  }
  if (key === "living") {
    return [
      `Living: ${profile.livingSituation ?? "—"}`,
      `Care network: ${profile.careNetwork ?? "—"}`,
      `Hours / week: ${profile.careHoursPerWeek ?? "—"}`,
      `Your proximity: ${profile.caregiverProximity ?? "—"}`,
    ].join("\n");
  }
  if (key === "aboutYou") {
    return [
      `Name: ${displayName}`,
      `Age: ${profile.caregiverAgeBracket ?? "—"}`,
      `Work: ${profile.caregiverWorkStatus ?? "—"}`,
      `How you’re doing: ${profile.caregiverState1_5 ?? "—"}/5`,
      `Hardest: ${(profile.hardestThing ?? "").trim() || "—"}`,
    ].join("\n");
  }
  return [
    `Background: ${(profile.crBackground ?? "").trim() || "—"}`,
    `Joy: ${(profile.crJoy ?? "").trim() || "—"}`,
    `More: ${(profile.crPersonalityNotes ?? "").trim() || "—"}`,
  ].join("\n");
}
