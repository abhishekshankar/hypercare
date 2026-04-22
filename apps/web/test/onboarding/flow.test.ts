import { describe, expect, it } from "vitest";

import { step2Schema } from "@/lib/onboarding/schemas";

/** Integration-style: v1 step-2 payload shape matches profile + onboarding save contract. */
describe("onboarding flow v1", () => {
  it("accepts a full v1 stage payload", () => {
    const r = step2Schema.safeParse({
      med_management_v1: "reminders",
      driving_v1: "worried",
      alone_safety_v1: ["nothing"],
      recognition_v1: "sometimes",
      bathing_dressing_v1: "hands_on_help",
      wandering_v1: "once",
      conversation_v1: "only_short",
      sleep_v1: "some_nights_hard",
    });
    expect(r.success).toBe(true);
  });
});
