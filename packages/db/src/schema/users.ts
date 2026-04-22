import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cognitoSub: text("cognito_sub").notNull().unique(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    /** See migration `0008_content_authoring_workflow.sql` — internal roles + `caregiver` default. */
    role: text("role").notNull().default("caregiver"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "users_role_check",
      sql`${t.role} IN (
        'caregiver', 'content_writer', 'content_lead', 'medical_director',
        'care_specialist', 'caregiver_support_clinician', 'lived_experience_reviewer', 'admin'
      )`,
    ),
  ],
);
