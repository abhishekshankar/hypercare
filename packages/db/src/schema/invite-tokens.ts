import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { careProfileMembers } from "./care-profile-members.js";

export const inviteTokens = pgTable("invite_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  careProfileMemberId: uuid("care_profile_member_id")
    .notNull()
    .references(() => careProfileMembers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  personalMessage: text("personal_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});
