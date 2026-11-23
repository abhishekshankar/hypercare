import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const privacyExportStatuses = ["pending", "complete", "error"] as const;
export type PrivacyExportStatus = (typeof privacyExportStatuses)[number];

export const privacyExportRequests = pgTable(
  "privacy_export_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").$type<PrivacyExportStatus>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    s3Key: text("s3_key"),
    error: text("error"),
  },
  (t) => [
    check(
      "privacy_export_requests_status_check",
      sql`${t.status} IN ('pending', 'complete', 'error')`,
    ),
    index("privacy_export_requests_user_id_created_at_idx").on(t.userId, t.createdAt.desc()),
  ],
);
