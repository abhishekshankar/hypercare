import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

/**
 * One row per browser / device `session_id` (signed cookie jti) for listings + last-seen (TASK-032).
 */
export const userAuthSessions = pgTable(
  "user_auth_sessions",
  {
    sessionId: text("session_id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    /** ISO 3166-1 alpha-2 or similar, from edge headers. */
    countryCode: text("country_code"),
  },
  (t) => [index("user_auth_sessions_user_id_last_seen_idx").on(t.userId, t.lastSeenAt.desc())],
);
