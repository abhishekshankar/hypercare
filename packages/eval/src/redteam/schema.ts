import { z } from "zod";

import { SAFETY_CLASSIFIER_CATEGORIES } from "@hypercare/safety";

const classifier = z.enum(SAFETY_CLASSIFIER_CATEGORIES);

export const redteamSourceSchema = z.enum(["adversarial", "lived_experience"]);

export const REDTEAM_BUCKETS = [
  "caregiver_self_harm",
  "care_recipient_in_danger",
  "elder_abuse_or_caregiver_breaking_point",
  "dangerous_request",
  "medical_emergency_disguised_as_question",
  "financial_or_legal_exploitation",
  "soft_flag_gray_zone",
  "non_crisis_everyday_caregiver",
] as const;

export const redteamBucketSchema = z.enum(REDTEAM_BUCKETS);

const resourceSpec = z.object({
  must_contain: z.string(),
});

const softFlagKindSchema = z.enum(["self_care_burnout", "caregiver_burnout"]);

const expectedSchema = z.object({
  triaged: z.boolean(),
  category: classifier.optional(),
  severity_min: z.enum(["high", "medium"]).optional(),
  script_match: z.boolean().optional(),
  resources: z.array(resourceSpec).optional(),
  suppression_triggered: z.boolean().optional(),
  soft_flag_kind: softFlagKindSchema.optional(),
  retrieval: z
    .object({
      top_tier_1: z.boolean().optional(),
    })
    .optional(),
});

export const redteamQuerySchema = z.object({
  id: z.string().min(1),
  bucket: redteamBucketSchema,
  text: z.string().min(1),
  expected: expectedSchema,
  /** If omitted, loaded fixtures default to `adversarial` (PRD §10.5 v2). */
  source: redteamSourceSchema.optional(),
  /**
   * Escalation script basename under `packages/safety/src/scripts/`, e.g. `caregiver-self-harm.md`.
   * If omitted, derived from `expected.category` + `text` when `expected.triaged` (TASK-035).
   */
  expected_flow: z.string().min(1).optional().nullable(),
  rationale: z.string().optional(),
  author: z.string().optional(),
  added_on: z.coerce.string().optional(),
});

export const redteamSetSchema = z.array(redteamQuerySchema).min(1);

export type RedteamBucket = (typeof REDTEAM_BUCKETS)[number];
export type RedteamQuery = z.infer<typeof redteamQuerySchema>;
export type RedteamExpected = z.infer<typeof expectedSchema>;
export type RedteamSource = z.infer<typeof redteamSourceSchema>;
