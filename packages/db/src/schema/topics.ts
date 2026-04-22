import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Closed vocabulary for MODULE-022 (topic classifier) and lesson picker. Seeded, not user-editable. */
export const topics = pgTable(
  "topics",
  {
    slug: text("slug").primaryKey(),
    category: text("category").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "topics_category_check",
      sql`${t.category} IN (
        'behaviors', 'daily_care', 'communication', 'medical', 'legal_financial',
        'transitions', 'caring_for_yourself'
      )`,
    ),
  ],
);
