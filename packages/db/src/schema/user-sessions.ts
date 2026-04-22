import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

/**
 * Minimal `/app/*` visit log for cohort denominators (TASK-029). No IP/UA.
 */
export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    visitedAt: timestamp("visited_at", { withTimezone: true }).defaultNow().notNull(),
    path: text("path").notNull(),
  },
  (t) => [index("user_sessions_user_id_visited_at_idx").on(t.userId, t.visitedAt.desc())],
);
