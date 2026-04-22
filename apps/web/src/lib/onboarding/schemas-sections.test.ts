import { describe, expect, it } from "vitest";

import { step1Schema, step2Schema } from "./schemas";

const step2Valid: Record<string, string> = {
  manages_meds: "yes",
  drives: "no",
  left_alone: "no",
  recognizes_you: "yes",
  bathes_alone: "no",
  wandering_incidents: "no",
  conversations: "yes",
  sleeps_through_night: "no",
};

describe("section zod (TASK-020)", () => {
  it("rejects an obviously bad about_cr payload", () => {
    const b = step1Schema.safeParse({ cr_first_name: "" });
    expect(b.success).toBe(false);
  });

  it("accepts a valid step2 object", () => {
    const p = step2Schema.safeParse(step2Valid);
    expect(p.success).toBe(true);
  });

  it("rejects invalid stage value", () => {
    const p = step2Schema.safeParse({ ...step2Valid, manages_meds: "maybe" });
    expect(p.success).toBe(false);
  });
});
