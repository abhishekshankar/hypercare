import { z } from "zod";
import { TOPICS_V0 } from "@alongside/db";

const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const validTopicSlugs = new Set(TOPICS_V0.map((t) => t.slug));

const topicSlugListSchema = z
  .array(z.string())
  .min(2, "topics: at least 2 slugs (closed vocabulary)")
  .max(4, "topics: at most 4 slugs in v0")
  .superRefine((slugs, ctx) => {
    for (const s of slugs) {
      if (!validTopicSlugs.has(s)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown topic slug "${s}". Use only slugs from the seeded topics table (see packages/db/src/seed/topic-seed-data.ts).`,
        });
      }
    }
  });

const categories = z.enum([
  "behaviors",
  "daily_care",
  "communication",
  "medical",
  "legal_financial",
  "transitions",
  "caring_for_yourself",
] as const);

const stages = z.enum(["early", "middle", "late"] as const);

export const moduleFrontMatterSchema = z
  .object({
    slug: z.string().regex(kebab, "slug must be kebab-case (lowercase letters, digits, single hyphens)"),
    title: z.string().min(1, "title is required"),
    category: categories,
    tier: z
      .union([z.number(), z.string()])
      .transform((t) => (typeof t === "string" ? Number.parseInt(t, 10) : t))
      .pipe(z.union([z.literal(1), z.literal(2), z.literal(3)])),
    stage_relevance: z.array(stages).min(1, "at least one stage in stage_relevance"),
    summary: z.string().min(1, "summary is required"),
    attribution_line: z.string().min(1, "attribution_line is required"),
    expert_reviewer: z.union([z.string().min(1), z.null()]).default(null),
    review_date: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/u), z.null()])
      .default(null),
    topics: topicSlugListSchema,
    try_this_today: z.string().min(1).optional(),
  })
  .strict();

export type ModuleFrontMatter = z.infer<typeof moduleFrontMatterSchema>;

const topicSlugListHeavySchema = z
  .array(z.string())
  .min(2, "topics: at least 2 slugs (closed vocabulary)")
  .max(12, "topics: at most 12 slugs for heavy Hermes bundles")
  .superRefine((slugs, ctx) => {
    for (const s of slugs) {
      if (!validTopicSlugs.has(s)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown topic slug "${s}". Use only slugs from the seeded topics table (see packages/db/src/seed/topic-seed-data.ts).`,
        });
      }
    }
  });

const secondaryTopicListSchema = z
  .array(z.string())
  .max(8, "secondary_topics: at most 8 slugs")
  .superRefine((slugs, ctx) => {
    for (const s of slugs) {
      if (!validTopicSlugs.has(s)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown secondary topic slug "${s}".`,
        });
      }
    }
  });

/**
 * Frontmatter for Hermes `module.md` on disk (superset of light-module fields).
 * `.passthrough()` allows Hermes-only keys (e.g. `related_tools`) without failing parse.
 */
export const heavyDiskFrontmatterSchema = moduleFrontMatterSchema
  .omit({ topics: true })
  .extend({
    topics: topicSlugListHeavySchema,
    heavy: z.boolean().optional(),
    bundle_version: z.coerce.number().int().positive().optional(),
    related_tools: z.array(z.string()).optional(),
    srs_suitable: z.boolean().optional(),
    srs_difficulty_bucket: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]).optional(),
    weeks_focus_eligible: z.boolean().optional(),
    weeks_focus_eligible_reason: z.string().optional(),
    soft_flag_companion_for: z.array(z.string()).optional(),
    secondary_topics: secondaryTopicListSchema.optional(),
    primary_topics: z.array(z.string()).max(12).optional(),
  })
  .passthrough();

export type HeavyDiskFrontmatter = z.infer<typeof heavyDiskFrontmatterSchema>;

export function parseReviewDate(
  v: z.infer<typeof moduleFrontMatterSchema>["review_date"],
): string | null {
  return v;
}
