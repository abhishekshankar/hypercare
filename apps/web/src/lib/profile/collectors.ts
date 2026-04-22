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
  const alone = fd.getAll("alone_safety_v1");
  return step2Schema.safeParse({
    med_management_v1: fd.get("med_management_v1"),
    driving_v1: fd.get("driving_v1"),
    alone_safety_v1: alone,
    recognition_v1: fd.get("recognition_v1"),
    bathing_dressing_v1: fd.get("bathing_dressing_v1"),
    wandering_v1: fd.get("wandering_v1"),
    conversation_v1: fd.get("conversation_v1"),
    sleep_v1: fd.get("sleep_v1"),
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
