import { describe, expect, it } from "vitest";

import { step1Schema, step2Schema } from "./schemas";

const step2Valid = {
  med_management_v1: "self",
  driving_v1: "safe",
  alone_safety_v1: ["nothing"],
  recognition_v1: "yes_usually",
  bathing_dressing_v1: "on_own",
  wandering_v1: "no",
  conversation_v1: "yes",
  sleep_v1: "sleep_through",
} as const;

describe("section zod (TASK-020)", () => {
  it("rejects an obviously bad about_cr payload", () => {
    const b = step1Schema.safeParse({ cr_first_name: "" });
    expect(b.success).toBe(false);
  });

  it("accepts a valid step2 object (v1)", () => {
    const p = step2Schema.safeParse(step2Valid);
    expect(p.success).toBe(true);
  });

  it("rejects invalid stage value", () => {
    const p = step2Schema.safeParse({ ...step2Valid, med_management_v1: "maybe" });
    expect(p.success).toBe(false);
  });
});
