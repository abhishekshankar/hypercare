import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

/** End-user product actions (transparency forget/refresh/clear, etc.). Distinct from `admin_audit`. */
export const userActions = pgTable(
  "user_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    path: text("path"),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("user_actions_user_id_action_at_idx").on(t.userId, t.action, t.at.desc())],
);
