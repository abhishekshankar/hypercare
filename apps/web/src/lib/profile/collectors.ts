import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
} from "@/lib/onboarding/schemas";

function optNum(v: FormDataEntryValue | null) {
  if (v == null || v === "") {
    return undefined;
  }
  return v;
}

export function parseStep1Form(fd: FormData) {
  return step1Schema.safeParse({
    cr_first_name: fd.get("cr_first_name"),
    cr_age: optNum(fd.get("cr_age")),
    cr_relationship: fd.get("cr_relationship"),
    cr_diagnosis: fd.get("cr_diagnosis"),
    cr_diagnosis_year: optNum(fd.get("cr_diagnosis_year")),
  });
}

export function parseStep2Form(fd: FormData) {
  return step2Schema.safeParse({
    manages_meds: fd.get("manages_meds"),
    drives: fd.get("drives"),
    left_alone: fd.get("left_alone"),
    recognizes_you: fd.get("recognizes_you"),
    bathes_alone: fd.get("bathes_alone"),
    wandering_incidents: fd.get("wandering_incidents"),
    conversations: fd.get("conversations"),
    sleeps_through_night: fd.get("sleeps_through_night"),
  });
}

export function parseStep3Form(fd: FormData) {
  return step3Schema.safeParse({
    living_situation: fd.get("living_situation"),
    care_network: fd.get("care_network"),
    care_hours_per_week: optNum(fd.get("care_hours_per_week")),
    caregiver_proximity: fd.get("caregiver_proximity"),
  });
}

export function parseStep4Form(fd: FormData) {
  return step4Schema.safeParse({
    display_name: fd.get("display_name"),
    caregiver_age_bracket: fd.get("caregiver_age_bracket"),
    caregiver_work_status: fd.get("caregiver_work_status"),
    caregiver_state_1_5: fd.get("caregiver_state_1_5"),
    hardest_thing: fd.get("hardest_thing"),
  });
}

export function parseStep5Form(fd: FormData) {
  return step5Schema.safeParse({
    cr_background: fd.get("cr_background") ?? "",
    cr_joy: fd.get("cr_joy") ?? "",
    cr_personality_notes: fd.get("cr_personality_notes") ?? "",
  });
}
