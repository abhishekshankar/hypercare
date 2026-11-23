import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

/**
 * 24h in-app feature suppression after caregiver-distress triage (PRD §10.3).
 * See ADR 0015.
 */
export const userSuppression = pgTable(
  "user_suppression",
  {
    userId: uuid("user_id")
      .primaryKey()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    until: timestamp("until", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
    setAt: timestamp("set_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "user_suppression_reason_check",
      sql`${t.reason} IN ('caregiver_self_harm', 'elder_abuse_or_caregiver_breaking_point')`,
    ),
  ],
);
