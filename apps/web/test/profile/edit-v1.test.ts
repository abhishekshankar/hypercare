import { describe, expect, it } from "vitest";

import { getStage2DefaultsForProfile } from "@/lib/onboarding/stage2-defaults";
import { careProfile } from "@alongside/db";

type Row = typeof careProfile.$inferSelect;

function base(over: Partial<Row>): Row {
  const r: Row = {
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
    stageQuestionsVersion: 1,
    medManagementV1: "self",
    drivingV1: "safe",
    aloneSafetyV1: ["nothing"],
    recognitionV1: "yes_usually",
    bathingDressingV1: "on_own",
    wanderingV1: "no",
    conversationV1: "yes",
    sleepV1: "sleep_through",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...r, ...over };
}

describe("profile edit v1 defaults", () => {
  it("round-trips v1 columns for the stage form", () => {
    const d = getStage2DefaultsForProfile(
      base({
        medManagementV1: "reminders",
        aloneSafetyV1: ["wandering", "falls"],
      }),
    );
    expect(d.med_management_v1).toBe("reminders");
    expect(d.alone_safety_v1).toEqual(["wandering", "falls"]);
  });
});
