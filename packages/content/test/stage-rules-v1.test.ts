import { describe, expect, it } from "vitest";

import { inferStageV1, type StageV1Answers } from "../src/stage-rules/v1-infer.js";
import { inferStageV0 } from "../src/stage-rules/v0-infer.js";
import { inferInferredStage, mapStageAnswersV0ToV1 } from "../src/stage-rules/index.js";
import type { StageAnswersRecord } from "../src/stage-rules/v0-keys.js";

function a(p: Partial<StageV1Answers>): StageV1Answers {
  return {
    medManagementV1: null,
    drivingV1: null,
    aloneSafetyV1: null,
    recognitionV1: null,
    bathingDressingV1: null,
    wanderingV1: null,
    conversationV1: null,
    sleepV1: null,
    ...p,
  } as StageV1Answers;
}

/** Representative v1 answer sets: expected label after TASK-034 rules. */
const FIXTURE: { label: string; want: "early" | "middle" | "late" | null; v1: StageV1Answers }[] = [
  {
    label: "healthy baseline",
    want: "early",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["nothing"],
      recognitionV1: "yes_always",
      bathingDressingV1: "on_own",
      wanderingV1: "no",
      conversationV1: "yes",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "reminders for meds only",
    want: "middle",
    v1: a({
      medManagementV1: "reminders",
      drivingV1: "safe",
      aloneSafetyV1: ["nothing"],
      recognitionV1: "yes_usually",
      bathingDressingV1: "on_own",
      wanderingV1: "no",
      conversationV1: "yes",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "late pattern A",
    want: "late",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["wandering", "falls"],
      recognitionV1: "rarely",
      bathingDressingV1: "hands_on_help",
      wanderingV1: "often",
      conversationV1: "rarely_makes_sense",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "partial answers (<5 filled)",
    want: null,
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: null,
      recognitionV1: "yes_usually",
      bathingDressingV1: "on_own",
      wanderingV1: null,
      conversationV1: null,
      sleepV1: null,
    }),
  },
  {
    label: "middle sleep disruption",
    want: "middle",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["nothing"],
      recognitionV1: "yes_usually",
      bathingDressingV1: "on_own",
      wanderingV1: "no",
      conversationV1: "yes",
      sleepV1: "most_nights_hard",
    }),
  },
  {
    label: "middle wandering once",
    want: "middle",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["nothing"],
      recognitionV1: "yes_usually",
      bathingDressingV1: "on_own",
      wanderingV1: "once",
      conversationV1: "yes",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "not late when only one trigger but unsafe alone",
    want: "middle",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["cooking"],
      recognitionV1: "rarely",
      bathingDressingV1: "on_own",
      wanderingV1: "no",
      conversationV1: "yes",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "early with sometimes recognition",
    want: "early",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["nothing"],
      recognitionV1: "sometimes",
      bathingDressingV1: "on_own",
      wanderingV1: "no",
      conversationV1: "yes",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "middle with_reminders ADL",
    want: "middle",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["nothing"],
      recognitionV1: "yes_usually",
      bathingDressingV1: "with_reminders",
      wanderingV1: "no",
      conversationV1: "yes",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "hands on meds",
    want: "middle",
    v1: a({
      medManagementV1: "hands_on_help",
      drivingV1: "safe",
      aloneSafetyV1: ["nothing"],
      recognitionV1: "yes_usually",
      bathingDressingV1: "on_own",
      wanderingV1: "no",
      conversationV1: "yes",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "late two triggers + unsafe",
    want: "late",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["other"],
      recognitionV1: "rarely",
      bathingDressingV1: "on_own",
      wanderingV1: "often",
      conversationV1: "yes",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "middle conversation short only",
    want: "middle",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["nothing"],
      recognitionV1: "yes_usually",
      bathingDressingV1: "on_own",
      wanderingV1: "no",
      conversationV1: "only_short",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "middle yes_repeats",
    want: "early",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["nothing"],
      recognitionV1: "yes_usually",
      bathingDressingV1: "on_own",
      wanderingV1: "no",
      conversationV1: "yes_repeats",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "some nights hard with margin",
    want: "middle",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["nothing"],
      recognitionV1: "yes_always",
      bathingDressingV1: "on_own",
      wanderingV1: "no",
      conversationV1: "yes",
      sleepV1: "some_nights_hard",
    }),
  },
  {
    label: "few times wander",
    want: "middle",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["nothing"],
      recognitionV1: "yes_usually",
      bathingDressingV1: "on_own",
      wanderingV1: "few_times",
      conversationV1: "yes",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "stopped driving still early if nothing else",
    want: "early",
    v1: a({
      medManagementV1: "self",
      drivingV1: "never_drove",
      aloneSafetyV1: ["nothing"],
      recognitionV1: "yes_usually",
      bathingDressingV1: "on_own",
      wanderingV1: "no",
      conversationV1: "yes",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "yes_always",
    want: "early",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["nothing"],
      recognitionV1: "yes_always",
      bathingDressingV1: "on_own",
      wanderingV1: "no",
      conversationV1: "yes",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "late minimal pair",
    want: "late",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["wandering"],
      recognitionV1: "rarely",
      bathingDressingV1: "hands_on_help",
      wanderingV1: "no",
      conversationV1: "yes",
      sleepV1: "sleep_through",
    }),
  },
  {
    label: "middle medication mistakes chip",
    want: "middle",
    v1: a({
      medManagementV1: "self",
      drivingV1: "safe",
      aloneSafetyV1: ["medication_mistakes"],
      recognitionV1: "yes_usually",
      bathingDressingV1: "on_own",
      wanderingV1: "no",
      conversationV1: "yes",
      sleepV1: "sleep_through",
    }),
  },
];

describe("inferStageV1 fixtures", () => {
  for (const row of FIXTURE) {
    it(row.label, () => {
      expect(inferStageV1(row.v1)).toBe(row.want);
    });
  }
});

describe("v0 and unified", () => {
  it("v0 all-yes / safe matches early with enough keys", () => {
    const v0: StageAnswersRecord = {
      manages_meds: "yes",
      drives: "yes",
      left_alone: "yes",
      recognizes_you: "yes",
      bathes_alone: "yes",
      wandering_incidents: "no",
      conversations: "yes",
      sleeps_through_night: "yes",
    };
    expect(inferStageV0(v0)).toBe("early");
  });

  it("unified v1 path uses columns", () => {
    const snap = {
      stageQuestionsVersion: 1,
      stageAnswers: {},
      medManagementV1: "self" as const,
      drivingV1: "safe" as const,
      aloneSafetyV1: ["nothing"] as const,
      recognitionV1: "yes_usually" as const,
      bathingDressingV1: "on_own" as const,
      wanderingV1: "no" as const,
      conversationV1: "yes" as const,
      sleepV1: "sleep_through" as const,
    };
    expect(inferInferredStage(snap)).toBe("early");
  });

  it("map + infer stability vs prior v0 middle example", () => {
    const v0: StageAnswersRecord = {
      manages_meds: "yes",
      drives: "no",
      left_alone: "no",
      recognizes_you: "yes",
      bathes_alone: "no",
      wandering_incidents: "no",
      conversations: "yes",
      sleeps_through_night: "no",
    };
    const m = mapStageAnswersV0ToV1(v0);
    const snap = {
      stageQuestionsVersion: 1,
      stageAnswers: {} as unknown,
      medManagementV1: m.medManagementV1!,
      drivingV1: m.drivingV1!,
      aloneSafetyV1: m.aloneSafetyV1!,
      recognitionV1: m.recognitionV1!,
      bathingDressingV1: m.bathingDressingV1!,
      wanderingV1: m.wanderingV1!,
      conversationV1: m.conversationV1!,
      sleepV1: m.sleepV1!,
    };
    expect(inferInferredStage(snap)).toBe("middle");
  });
});
