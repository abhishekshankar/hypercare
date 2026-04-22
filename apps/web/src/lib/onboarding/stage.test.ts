import { describe, expect, it } from "vitest";

import { inferStage } from "./stage";
import type { StageAnswersRecord } from "./stage-keys";

const base: StageAnswersRecord = {
  manages_meds: "yes",
  drives: "yes",
  left_alone: "yes",
  recognizes_you: "yes",
  bathes_alone: "yes",
  wandering_incidents: "no",
  conversations: "yes",
  sleeps_through_night: "yes",
};

describe("inferStage", () => {
  it("returns null when fewer than 5 answers", () => {
    expect(inferStage({ manages_meds: "yes", drives: "no" })).toBeNull();
  });

  it("returns late when two late triggers and left_alone is no", () => {
    const a: StageAnswersRecord = {
      ...base,
      recognizes_you: "no",
      bathes_alone: "no",
      left_alone: "no",
      wandering_incidents: "no",
    };
    expect(inferStage(a)).toBe("late");
  });

  it("does not return late when left_alone is not no", () => {
    const a: StageAnswersRecord = {
      ...base,
      recognizes_you: "no",
      bathes_alone: "no",
      conversations: "no",
      wandering_incidents: "yes",
      left_alone: "yes",
    };
    expect(inferStage(a)).not.toBe("late");
  });

  it("returns middle when a middle trigger fires and not late", () => {
    const a: StageAnswersRecord = {
      ...base,
      manages_meds: "no",
      left_alone: "yes",
    };
    expect(inferStage(a)).toBe("middle");
  });

  it("returns early when no late/middle triggers and enough answers", () => {
    expect(inferStage(base)).toBe("early");
  });
});
