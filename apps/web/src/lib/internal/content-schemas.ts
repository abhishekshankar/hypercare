import { z } from "zod";

export const postBriefBody = z.object({
  topic: z.string().min(1),
  audience: z.string().min(1),
  stageRelevance: z
    .array(z.enum(["early", "middle", "late", "any"]))
    .default([])
    .refine(
      (a) => a.length === 0 || a.some((x) => x !== "any") || a.length === 1,
      "if using any, use ['any'] alone for clarity",
    ),
  desiredOutcome: z.string().min(1),
  proposedTitle: z.string().optional(),
  queueReason: z.enum(["content_plan", "refusal_path", "user_request"]).default("content_plan"),
});

export const patchModuleBody = z.object({
  title: z.string().min(1).optional(),
  bodyMd: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  tryThisToday: z.string().optional().nullable(),
  category: z
    .enum([
      "behaviors",
      "daily_care",
      "communication",
      "medical",
      "legal_financial",
      "transitions",
      "caring_for_yourself",
    ])
    .optional(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  stageRelevance: z.array(z.enum(["early", "middle", "late"])).min(1).optional(),
  topicSlugs: z.array(z.string().min(1)).min(2).max(4).optional(),
  attributionLine: z.string().min(1).optional(),
  expertReviewer: z.string().optional().nullable(),
  assignedExpertReviewerId: z.string().uuid().optional().nullable(),
  assignedLivedReviewerId: z.string().uuid().optional().nullable(),
});

export const postEvidenceBody = z.object({
  sourceTier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  sourceType: z.enum(["url", "book", "paper", "intervention", "pac"]),
  citation: z.string().min(1),
  url: z.string().optional().nullable(),
  quotedSupport: z.string().optional().nullable(),
});

const draftStatusZ = z.enum([
  "draft",
  "content_lead_review",
  "expert_review",
  "lived_experience_review",
  "approved",
  "published",
  "retired",
]);

export const postTransitionBody = z.object({
  to: draftStatusZ,
  reason: z.string().optional().nullable(),
});

const reviewVerdictZ = z.enum(["approve", "reject", "request_changes"]);
const reviewRoleZ = z.enum([
  "content_lead",
  "medical_director",
  "care_specialist",
  "caregiver_support_clinician",
  "lived_experience",
  "domain_sme",
]);

export const postReviewBody = z.object({
  verdict: reviewVerdictZ,
  commentsMd: z.string().optional().nullable(),
  reviewRole: reviewRoleZ.optional(),
});
