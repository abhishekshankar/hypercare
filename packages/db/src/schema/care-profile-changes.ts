import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const careProfileChanges = pgTable(
  "care_profile_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Editor who made the change (TASK-038; mirrors `user_id` for legacy rows). */
    changedBy: uuid("changed_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    section: text("section").notNull(),
    field: text("field").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
    trigger: text("trigger").notNull(),
  },
  (t) => [
    check(
      "care_profile_changes_section_check",
      sql`${t.section} IN (
        'about_cr', 'stage', 'living', 'about_you', 'what_matters'
      )`,
    ),
    check(
      "care_profile_changes_trigger_check",
      sql`${t.trigger} IN ('user_edit', 'evolved_state_flow', 'system_inferred')`,
    ),
    index("care_profile_changes_user_id_changed_at_idx").on(
      t.userId,
      t.changedAt.desc().nullsLast(),
    ),
    index("care_profile_changes_user_id_section_changed_at_idx").on(
      t.userId,
      t.section,
      t.changedAt.desc().nullsLast(),
    ),
  ],
);
