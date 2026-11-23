import { describe, expect, it } from "vitest";

import { careProfile } from "@alongside/db";

import {
  getFirstIncompleteStep,
  hasCompletedOnboardingFromFlags,
  isWizardDataCompleteFromSnapshot,
} from "./status";

type Row = typeof careProfile.$inferSelect;

function row(partial: Partial<Row>): Row {
  const base = {
    id: "00000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000002",
    crFirstName: "Pat",
    crAge: null,
    crRelationship: "parent",
    crDiagnosis: null,
    crDiagnosisYear: null,
    stageAnswers: {},
    inferredStage: null,
    livingSituation: null,
    careNetwork: null,
    careHoursPerWeek: null,
    caregiverProximity: null,
    caregiverAgeBracket: null,
    caregiverWorkStatus: null,
    caregiverState1_5: null,
    hardestThing: null,
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
  return { ...base, ...partial };
}

describe("isWizardDataCompleteFromSnapshot", () => {
  it("false without display name", () => {
    expect(isWizardDataCompleteFromSnapshot(row({ crBackground: "" }), null)).toBe(false);
  });

  it("false without step 5 write", () => {
    expect(
      isWizardDataCompleteFromSnapshot(
        row({
          stageAnswers: {
            manages_meds: "yes",
            drives: "yes",
            left_alone: "yes",
            recognizes_you: "yes",
            bathes_alone: "yes",
            wandering_incidents: "no",
            conversations: "yes",
            sleeps_through_night: "yes",
          },
          livingSituation: "alone",
          careNetwork: "solo",
          caregiverProximity: "same_city",
          caregiverAgeBracket: "40_54",
          caregiverWorkStatus: "working",
          caregiverState1_5: 3,
          crBackground: null,
        }),
        "Alex",
      ),
    ).toBe(false);
  });

  it("true when ticket minimum + step 5", () => {
    expect(
      isWizardDataCompleteFromSnapshot(
        row({
          stageAnswers: {
            manages_meds: "yes",
            drives: "yes",
            left_alone: "yes",
            recognizes_you: "yes",
            bathes_alone: "yes",
            wandering_incidents: "no",
            conversations: "yes",
            sleeps_through_night: "yes",
          },
          livingSituation: "alone",
          careNetwork: "solo",
          caregiverProximity: "same_city",
          caregiverAgeBracket: "40_54",
          caregiverWorkStatus: "working",
          caregiverState1_5: 3,
          crBackground: "",
        }),
        "Alex",
      ),
    ).toBe(true);
  });
});

describe("hasCompletedOnboardingFromFlags", () => {
  it("false without ack even when data is complete", () => {
    const r = row({
      crBackground: "",
      stageAnswers: {
        manages_meds: "yes",
        drives: "yes",
        left_alone: "yes",
        recognizes_you: "yes",
        bathes_alone: "yes",
        wandering_incidents: "no",
        conversations: "yes",
        sleeps_through_night: "yes",
      },
      livingSituation: "alone",
      careNetwork: "solo",
      caregiverProximity: "same_city",
      caregiverAgeBracket: "40_54",
      caregiverWorkStatus: "working",
      caregiverState1_5: 3,
    });
    expect(hasCompletedOnboardingFromFlags(false, r, "A")).toBe(false);
  });

  it("true with ack and complete data", () => {
    const r = row({
      crBackground: "",
      stageAnswers: {
        manages_meds: "yes",
        drives: "yes",
        left_alone: "yes",
        recognizes_you: "yes",
        bathes_alone: "yes",
        wandering_incidents: "no",
        conversations: "yes",
        sleeps_through_night: "yes",
      },
      livingSituation: "alone",
      careNetwork: "solo",
      caregiverProximity: "same_city",
      caregiverAgeBracket: "40_54",
      caregiverWorkStatus: "working",
      caregiverState1_5: 3,
    });
    expect(hasCompletedOnboardingFromFlags(true, r, "A")).toBe(true);
  });
});

describe("getFirstIncompleteStep", () => {
  it("returns 1 when missing CR basics", () => {
    expect(getFirstIncompleteStep(row({ crFirstName: "" }), "A")).toBe(1);
  });

  it("returns 2 when stage incomplete", () => {
    expect(
      getFirstIncompleteStep(
        row({
          crFirstName: "M",
          crRelationship: "parent",
          stageAnswers: { manages_meds: "yes" },
        }),
        "A",
      ),
    ).toBe(2);
  });

  it("returns 5 when step 4 done but not step 5", () => {
    expect(
      getFirstIncompleteStep(
        row({
          crFirstName: "M",
          crRelationship: "parent",
          stageAnswers: {
            manages_meds: "yes",
            drives: "yes",
            left_alone: "yes",
            recognizes_you: "yes",
            bathes_alone: "yes",
            wandering_incidents: "no",
            conversations: "yes",
            sleeps_through_night: "yes",
          },
          livingSituation: "alone",
          careNetwork: "solo",
          caregiverProximity: "remote",
          caregiverAgeBracket: "55_64",
          caregiverWorkStatus: "retired",
          caregiverState1_5: 2,
          crBackground: null,
        }),
        "Alex",
      ),
    ).toBe(5);
  });

  it("returns null when wizard data is complete through step 5", () => {
    expect(
      getFirstIncompleteStep(
        row({
          crFirstName: "M",
          crRelationship: "parent",
          stageAnswers: {
            manages_meds: "yes",
            drives: "yes",
            left_alone: "yes",
            recognizes_you: "yes",
            bathes_alone: "yes",
            wandering_incidents: "no",
            conversations: "yes",
            sleeps_through_night: "yes",
          },
          livingSituation: "alone",
          careNetwork: "solo",
          caregiverProximity: "remote",
          caregiverAgeBracket: "55_64",
          caregiverWorkStatus: "retired",
          caregiverState1_5: 2,
          crBackground: "",
        }),
        "Alex",
      ),
    ).toBeNull();
  });
});
