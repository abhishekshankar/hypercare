import { z } from "zod";

const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

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
  })
  .strict();

export type ModuleFrontMatter = z.infer<typeof moduleFrontMatterSchema>;

export function parseReviewDate(
  v: z.infer<typeof moduleFrontMatterSchema>["review_date"],
): string | null {
  return v;
}
