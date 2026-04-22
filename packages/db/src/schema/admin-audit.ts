import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const adminAudit = pgTable(
  "admin_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    path: text("path").notNull(),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
    /** Optional structured payload (e.g. account delete subject id after user row is gone). */
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    /** Operator / privacy delete reason; human-readable. */
    reason: text("reason"),
  },
  (t) => [index("admin_audit_user_id_at_idx").on(t.userId, t.at.desc())],
);
