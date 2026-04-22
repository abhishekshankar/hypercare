import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { modules } from "./modules.js";

/**
 * SM-2-lite bucket schedule per user + module (TASK-037).
 * Row created on lesson start; `due_at` / `bucket` updated on completion and revisit.
 */
export const lessonReviewSchedule = pgTable(
  "lesson_review_schedule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    bucket: integer("bucket").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    lastOutcome: text("last_outcome").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "lesson_review_schedule_last_outcome_check",
      sql`${t.lastOutcome} IN ('completed', 'started_not_completed', 'revisit_requested')`,
    ),
    check(
      "lesson_review_schedule_bucket_check",
      sql`${t.bucket} >= 0 AND ${t.bucket} <= 5`,
    ),
    unique("lesson_review_schedule_user_id_module_id_unique").on(t.userId, t.moduleId),
    index("lesson_review_schedule_user_id_due_at_idx").on(t.userId, t.dueAt),
  ],
);
