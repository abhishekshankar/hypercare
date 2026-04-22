import { describe, expect, it } from "vitest";

import { composeOnboardingSummary } from "./summary";
import type { StageAnswersRecord } from "./stage-keys";

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
  it("all fields set", () => {
    const s = composeOnboardingSummary({
      displayName: "Alex",
      crFirstName: "Margaret",
      crAge: 78,
      crRelationship: "parent",
      crDiagnosis: "alzheimers",
      crDiagnosisYear: 2020,
      livingSituation: "with_caregiver",
      caregiverProximity: "same_home",
      hardestThing: "sundowning",
      stageAnswers: stage,
    });
    expect(s.startsWith("Okay. Alex,")).toBe(true);
    expect(s).toContain("Margaret");
    expect(s).toContain("hardest thing");
    expect(s).toContain("sundowning");
  });

  it("minimal required tone", () => {
    const s = composeOnboardingSummary({
      displayName: "Sam",
      crFirstName: "Pat",
      crAge: null,
      crRelationship: "spouse",
      crDiagnosis: null,
      crDiagnosisYear: null,
      livingSituation: null,
      caregiverProximity: null,
      hardestThing: null,
      stageAnswers: {},
    });
    expect(s).toContain("Okay. Sam,");
    expect(s).toContain("Pat");
    expect(s).toMatch(/Let's get started\.$/);
  });

  it("missing diagnosis year", () => {
    const s = composeOnboardingSummary({
      displayName: "A",
      crFirstName: "B",
      crAge: 70,
      crRelationship: "sibling",
      crDiagnosis: "vascular",
      crDiagnosisYear: null,
      livingSituation: "alone",
      caregiverProximity: "remote",
      hardestThing: null,
      stageAnswers: {},
    });
    expect(s).toContain("vascular");
    expect(s).not.toMatch(/\(around/);
  });

  it("remote caregiver proximity", () => {
    const s = composeOnboardingSummary({
      displayName: "A",
      crFirstName: "B",
      crAge: null,
      crRelationship: "other",
      crDiagnosis: null,
      crDiagnosisYear: null,
      livingSituation: "nursing_home",
      caregiverProximity: "remote",
      hardestThing: null,
      stageAnswers: {},
    });
    expect(s).toContain("distance");
  });
});
