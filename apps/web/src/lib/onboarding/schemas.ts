import { z } from "zod";

import { STAGE_ANSWER_KEYS, type StageAnswerKey } from "./stage-keys";

const crRelationshipEnum = z.enum(["parent", "spouse", "sibling", "in_law", "other"]);

const crDiagnosisEnum = z.enum([
  "alzheimers",
  "vascular",
  "lewy_body",
  "frontotemporal",
  "mixed",
  "unknown_type",
  "suspected_undiagnosed",
]);

const ynUnsure = z.enum(["yes", "no", "unsure"]);

const livingEnum = z.enum([
  "with_caregiver",
  "alone",
  "with_other_family",
  "assisted_living",
  "memory_care",
  "nursing_home",
]);

const careNetworkEnum = z.enum(["solo", "siblings_helping", "paid_help", "spouse_of_cr"]);

const proximityEnum = z.enum(["same_home", "same_city", "remote"]);

const ageBracketEnum = z.enum(["under_40", "40_54", "55_64", "65_74", "75_plus"]);

const workEnum = z.enum(["working", "retired", "other"]);

function optionalIntInRange(min: number, max: number) {
  return z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(min).max(max).optional(),
  );
}

function optionalYear() {
  return z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(1900).max(2100).optional(),
  );
}

/** Step 1 — About CR */
export const step1Schema = z.object({
  cr_first_name: z.string().trim().min(1, "First name is required"),
  cr_age: optionalIntInRange(0, 120),
  cr_relationship: crRelationshipEnum,
  cr_diagnosis: z.preprocess((v) => {
    if (v === "" || v == null || v === "__prefer_not__") {
      return null;
    }
    return v;
  }, crDiagnosisEnum.nullable()),
  cr_diagnosis_year: optionalYear(),
});

/** Step 2 — Stage assessment (all eight required) */
const stageShape = Object.fromEntries(
  STAGE_ANSWER_KEYS.map((k) => [k, ynUnsure]),
) as Record<StageAnswerKey, typeof ynUnsure>;

export const step2Schema = z.object(stageShape as z.ZodRawShape);

/** Step 3 — Living / care */
export const step3Schema = z.object({
  living_situation: livingEnum,
  care_network: careNetworkEnum,
  care_hours_per_week: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(0).max(168).optional(),
  ),
  caregiver_proximity: proximityEnum,
});

/** Step 4 — Caregiver */
export const step4Schema = z.object({
  display_name: z.string().trim().min(1, "Your first name is required"),
  caregiver_age_bracket: ageBracketEnum,
  caregiver_work_status: workEnum,
  caregiver_state_1_5: z.coerce.number().int().min(1).max(5),
  hardest_thing: z
    .string()
    .max(500, "Please keep this to 500 characters or fewer")
    .optional()
    .transform((s) => (s == null || s.trim() === "" ? null : s.trim())),
});

/** Step 5 — What matters (always persisted as strings; empty → "") */
export const step5Schema = z.object({
  cr_background: z
    .string()
    .max(500, "Please keep this to 500 characters or fewer")
    .transform((s) => s.trim()),
  cr_joy: z
    .string()
    .max(500, "Please keep this to 500 characters or fewer")
    .transform((s) => s.trim()),
  cr_personality_notes: z
    .string()
    .max(500, "Please keep this to 500 characters or fewer")
    .transform((s) => s.trim()),
});

export type Step1Input = z.infer<typeof step1Schema>;
export type Step2Input = z.infer<typeof step2Schema>;
export type Step3Input = z.infer<typeof step3Schema>;
export type Step4Input = z.infer<typeof step4Schema>;
export type Step5Input = z.infer<typeof step5Schema>;

export function flattenFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".") || "_root";
    if (out[path] == null) {
      out[path] = issue.message;
    }
  }
  return out;
}
