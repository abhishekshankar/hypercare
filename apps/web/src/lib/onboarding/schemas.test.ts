import { describe, expect, it } from "vitest";

import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
} from "./schemas";

describe("step1Schema", () => {
  it("accepts valid payload", () => {
    const r = step1Schema.safeParse({
      cr_first_name: "  Mo ",
      cr_age: "72",
      cr_relationship: "parent",
      cr_diagnosis: "alzheimers",
      cr_diagnosis_year: "2019",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cr_first_name).toBe("Mo");
      expect(r.data.cr_age).toBe(72);
    }
  });

  it("rejects empty name", () => {
    const r = step1Schema.safeParse({
      cr_first_name: "   ",
      cr_relationship: "parent",
      cr_diagnosis: "__prefer_not__",
    });
    expect(r.success).toBe(false);
  });

  it("maps prefer not to null diagnosis", () => {
    const r = step1Schema.safeParse({
      cr_first_name: "A",
      cr_relationship: "spouse",
      cr_diagnosis: "__prefer_not__",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cr_diagnosis).toBeNull();
    }
  });

  it("rejects age out of range", () => {
    const r = step1Schema.safeParse({
      cr_first_name: "A",
      cr_relationship: "other",
      cr_age: "200",
      cr_diagnosis: "__prefer_not__",
    });
    expect(r.success).toBe(false);
  });
});

describe("step2Schema", () => {
  it("requires all eight v1 fields", () => {
    const r = step2Schema.safeParse({
      med_management_v1: "self",
      driving_v1: "safe",
      alone_safety_v1: ["nothing"],
      recognition_v1: "yes_usually",
      bathing_dressing_v1: "on_own",
      wandering_v1: "no",
      conversation_v1: "yes",
    });
    expect(r.success).toBe(false);
  });
});

describe("step3Schema", () => {
  it("accepts valid enums", () => {
    const r = step3Schema.safeParse({
      living_situation: "memory_care",
      care_network: "paid_help",
      caregiver_proximity: "same_city",
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid living situation", () => {
    const r = step3Schema.safeParse({
      living_situation: "mars",
      care_network: "solo",
      caregiver_proximity: "remote",
    });
    expect(r.success).toBe(false);
  });
});

describe("step4Schema", () => {
  it("accepts state 1–5", () => {
    const r = step4Schema.safeParse({
      display_name: "Jo",
      caregiver_age_bracket: "65_74",
      caregiver_work_status: "retired",
      caregiver_state_1_5: "4",
      hardest_thing: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.caregiver_state_1_5).toBe(4);
      expect(r.data.hardest_thing).toBeNull();
    }
  });

  it("rejects state out of range", () => {
    const r = step4Schema.safeParse({
      display_name: "Jo",
      caregiver_age_bracket: "65_74",
      caregiver_work_status: "retired",
      caregiver_state_1_5: "9",
    });
    expect(r.success).toBe(false);
  });

  it("rejects longest hardest_thing", () => {
    const r = step4Schema.safeParse({
      display_name: "Jo",
      caregiver_age_bracket: "65_74",
      caregiver_work_status: "retired",
      caregiver_state_1_5: "2",
      hardest_thing: "x".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

describe("step5Schema", () => {
  it("trims text areas", () => {
    const r = step5Schema.safeParse({
      cr_background: "  hi ",
      cr_joy: "",
      cr_personality_notes: "notes",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cr_background).toBe("hi");
      expect(r.data.cr_joy).toBe("");
    }
  });
});
