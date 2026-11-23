import { describe, expect, it } from "vitest";

import { inferStage } from "../src/care/stage.js";

describe("care/stage — inferStage (mirror of apps/web)", () => {
  it("returns null when fewer than 5 questions are answered", () => {
    expect(inferStage({ manages_meds: "yes", drives: "no" })).toBeNull();
  });

  it("returns 'late' when 2+ late triggers AND left_alone=no", () => {
    expect(
      inferStage({
        manages_meds: "no",
        drives: "no",
        left_alone: "no",
        recognizes_you: "no",
        bathes_alone: "no",
        wandering_incidents: "yes",
        conversations: "no",
        sleeps_through_night: "no",
      }),
    ).toBe("late");
  });

  it("returns 'middle' for any one middle trigger when not late", () => {
    expect(
      inferStage({
        manages_meds: "no",
        drives: "yes",
        left_alone: "yes",
        recognizes_you: "yes",
        bathes_alone: "yes",
        wandering_incidents: "no",
        conversations: "yes",
        sleeps_through_night: "yes",
      }),
    ).toBe("middle");
  });

  it("returns 'early' when not late, not middle, and >=5 answered", () => {
    expect(
      inferStage({
        manages_meds: "yes",
        drives: "yes",
        left_alone: "yes",
        recognizes_you: "yes",
        bathes_alone: "yes",
        wandering_incidents: "no",
        conversations: "yes",
        sleeps_through_night: "yes",
      }),
    ).toBe("early");
  });
});
