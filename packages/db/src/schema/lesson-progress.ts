import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { modules } from "./modules.js";

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    revisit: boolean("revisit").notNull().default(false),
    source: text("source").notNull(),
  },
  (t) => [
    check(
      "lesson_progress_source_check",
      sql`${t.source} IN (
        'weekly_focus', 'library_browse', 'search', 'conversation_link'
      )`,
    ),
    unique("lesson_progress_user_id_module_id_started_at_unique").on(
      t.userId,
      t.moduleId,
      t.startedAt,
    ),
    index("lesson_progress_user_id_completed_at_idx").on(t.userId, t.completedAt.desc().nullsLast()),
    index("lesson_progress_user_id_module_id_idx").on(t.userId, t.moduleId),
  ],
);
