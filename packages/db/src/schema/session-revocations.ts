import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const sessionRevocationReasons = [
  "logout",
  "user_delete",
  "admin_revoke",
  "ttl",
] as const;
export type SessionRevocationReason = (typeof sessionRevocationReasons)[number];

/**
 * When present, the signed `hc_session` is invalid even if signature + exp look valid (TASK-032).
 */
export const sessionRevocations = pgTable(
  "session_revocations",
  {
    sessionId: text("session_id").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }).defaultNow().notNull(),
    reason: text("reason").$type<SessionRevocationReason>().notNull(),
  },
  (t) => [
    check(
      "session_revocations_reason_check",
      sql`${t.reason} IN ('logout', 'user_delete', 'admin_revoke', 'ttl')`,
    ),
  ],
);
