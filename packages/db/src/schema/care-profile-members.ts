import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { careProfile } from "./care-profile.js";
import { users } from "./users.js";

/** Max co-caregiver seats (owner is separate). Owner + this many = 4 household members. TASK-038. */
export const MAX_CO_CAREGIVERS_PER_PROFILE = 3;

export const careProfileMembers = pgTable(
  "care_profile_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    careProfileId: uuid("care_profile_id")
      .notNull()
      .references(() => careProfile.id, { onDelete: "cascade" }),
    /** Set after the invite is accepted; null while pending. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** Lowercased email for pending `co_caregiver` rows (spec gap: invite before account exists). */
    inviteeEmail: text("invitee_email"),
    role: text("role").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invitedAt: timestamp("invited_at", { withTimezone: true }).defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    shareConversationsWithOtherMembers: boolean("share_conversations_with_other_members")
      .notNull()
      .default(false),
    shareSavedAnswersWithOtherMembers: boolean("share_saved_answers_with_other_members")
      .notNull()
      .default(false),
  },
  (t) => [
    check("care_profile_members_role_check", sql`${t.role} IN ('owner', 'co_caregiver')`),
    check(
      "care_profile_members_state_check",
      sql`(
        (${t.role} = 'owner' AND ${t.userId} IS NOT NULL AND ${t.acceptedAt} IS NOT NULL AND ${t.inviteeEmail} IS NULL)
        OR (${t.role} = 'co_caregiver' AND ${t.acceptedAt} IS NOT NULL AND ${t.userId} IS NOT NULL AND ${t.inviteeEmail} IS NULL)
        OR (${t.role} = 'co_caregiver' AND ${t.acceptedAt} IS NULL AND ${t.userId} IS NULL AND ${t.inviteeEmail} IS NOT NULL)
      )`,
    ),
    index("care_profile_members_user_id_idx").on(t.userId),
    index("care_profile_members_care_profile_id_idx").on(t.careProfileId),
  ],
);
