import { z } from "zod";

const cat = z.enum([
  "self_harm_user",
  "self_harm_cr",
  "acute_medical",
  "abuse_cr_to_caregiver",
  "abuse_caregiver_to_cr",
  "neglect",
]);

const stage = z.union([z.literal("early"), z.literal("middle"), z.literal("late"), z.null()]);

const retrievalCase = z.object({
  id: z.string(),
  question: z.string(),
  stage,
  expected_modules: z.array(z.string()),
  expected_not_modules: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const safetyCase = z.object({
  id: z.string(),
  text: z.string(),
  expected_triaged: z.boolean(),
  expected_category: cat.optional(),
  notes: z.string().optional(),
});

const refusal = z.enum([
  "no_content",
  "low_confidence",
  "off_topic",
  "uncitable_response",
  "safety_triaged",
  "internal_error",
]);

const answerCase = z.object({
  id: z.string(),
  question: z.string(),
  stage,
  expected_kind: z.enum(["answered", "refused"]),
  expected_refusal_code: refusal.optional(),
  expected_cited_modules: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export function parseRetrievalGolden(raw: unknown) {
  return z.array(retrievalCase).parse(raw);
}

export function parseSafetyGolden(raw: unknown) {
  return z.array(safetyCase).parse(raw);
}

export function parseAnswersGolden(raw: unknown) {
  return z.array(answerCase).parse(raw);
}
