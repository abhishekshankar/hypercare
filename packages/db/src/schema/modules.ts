import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    stageRelevance: text("stage_relevance").array().notNull().default(sql`'{}'::text[]`),
    tier: integer("tier").notNull(),
    summary: text("summary").notNull(),
    bodyMd: text("body_md").notNull(),
    attributionLine: text("attribution_line").notNull(),
    expertReviewer: text("expert_reviewer"),
    reviewDate: date("review_date"),
    nextReviewDue: date("next_review_due"),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "modules_category_check",
      sql`${t.category} IN (
        'behaviors', 'daily_care', 'communication', 'medical', 'legal_financial',
        'transitions', 'caring_for_yourself'
      )`,
    ),
    check("modules_tier_check", sql`${t.tier} IN (1, 2, 3)`),
    index("modules_category_tier_published_idx").on(t.category, t.tier, t.published),
  ],
);
