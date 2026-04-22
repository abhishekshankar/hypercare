import { describe, expect, it } from "vitest";

import { careProfile } from "@hypercare/db";

import { composeOnboardingSummary } from "./summary";
import type { StageAnswersRecord } from "./stage-keys";

type CareRow = typeof careProfile.$inferSelect;

function makeProfile(over: Partial<CareRow>): CareRow {
  const base: CareRow = {
    id: "00000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000002",
    crFirstName: "Margaret",
    crAge: 78,
    crRelationship: "parent",
    crDiagnosis: "alzheimers",
    crDiagnosisYear: 2020,
    livingSituation: "with_caregiver",
    careNetwork: "solo",
    careHoursPerWeek: null,
    caregiverProximity: "same_home",
    caregiverAgeBracket: null,
    caregiverWorkStatus: null,
    caregiverState1_5: null,
    stageAnswers: {},
    inferredStage: null,
    hardestThing: "sundowning",
    crBackground: null,
    crJoy: null,
    crPersonalityNotes: null,
    stageQuestionsVersion: 0,
    medManagementV1: null,
    drivingV1: null,
    aloneSafetyV1: null,
    recognitionV1: null,
    bathingDressingV1: null,
    wanderingV1: null,
    conversationV1: null,
    sleepV1: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, ...over };
}

const stage: StageAnswersRecord = {
  manages_meds: "yes",
  drives: "no",
  left_alone: "no",
  bathes_alone: "no",
  wandering_incidents: "yes",
  recognizes_you: "yes",
  conversations: "yes",
  sleeps_through_night: "yes",
};

describe("composeOnboardingSummary", () => {
  it("all fields set (v0 stage_answers)", () => {
    const s = composeOnboardingSummary({
      displayName: "Alex",
      profile: makeProfile({ stageAnswers: stage }),
    });
    expect(s.startsWith("Okay. Alex,")).toBe(true);
    expect(s).toContain("Margaret");
    expect(s).toContain("hardest thing");
    expect(s).toContain("sundowning");
  });

  it("minimal required tone", () => {
    const s = composeOnboardingSummary({
      displayName: "Sam",
      profile: makeProfile({
        crFirstName: "Pat",
        crAge: null,
        crRelationship: "spouse",
        crDiagnosis: null,
        crDiagnosisYear: null,
        livingSituation: null,
        caregiverProximity: null,
        hardestThing: null,
        stageAnswers: {},
      }),
    });
    expect(s).toContain("Okay. Sam,");
    expect(s).toContain("Pat");
    expect(s).toMatch(/Let's get started\.$/);
  });

  it("missing diagnosis year", () => {
    const s = composeOnboardingSummary({
      displayName: "A",
      profile: makeProfile({
        crFirstName: "B",
        crAge: 70,
        crRelationship: "sibling",
        crDiagnosis: "vascular",
        crDiagnosisYear: null,
        livingSituation: "alone",
        caregiverProximity: "remote",
        hardestThing: null,
        stageAnswers: {},
      }),
    });
    expect(s).toContain("vascular");
    expect(s).not.toMatch(/\(around/);
  });

  it("remote caregiver proximity", () => {
    const s = composeOnboardingSummary({
      displayName: "A",
      profile: makeProfile({
        crFirstName: "B",
        crAge: null,
        crRelationship: "other",
        crDiagnosis: null,
        crDiagnosisYear: null,
        livingSituation: "nursing_home",
        caregiverProximity: "remote",
        hardestThing: null,
        stageAnswers: {},
      }),
    });
    expect(s).toContain("distance");
  });
});
