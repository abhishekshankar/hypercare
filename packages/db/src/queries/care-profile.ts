import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "../schema/index.js";
import { careProfile, careProfileMembers } from "../schema/index.js";

export type DbWithSchema = PostgresJsDatabase<typeof schema>;

export class MultipleProfilesNotSupportedError extends Error {
  readonly code = "MULTIPLE_CARE_PROFILES" as const;
  constructor() {
    super("Alongside does not support helping with two care profiles yet.");
    this.name = "MultipleProfilesNotSupportedError";
  }
}

export type CareProfileBundle = {
  profile: typeof careProfile.$inferSelect;
  membership: typeof careProfileMembers.$inferSelect;
};

/**
 * Active accepted membership → shared `care_profile` row (TASK-038).
 * Pending invites (no `user_id` yet) are not returned here.
 */
export async function getCareProfileForUser(
  db: DbWithSchema,
  userId: string,
): Promise<CareProfileBundle | null> {
  const rows = await db
    .select({ membership: careProfileMembers, profile: careProfile })
    .from(careProfileMembers)
    .innerJoin(careProfile, eq(careProfile.id, careProfileMembers.careProfileId))
    .where(
      and(
        eq(careProfileMembers.userId, userId),
        isNull(careProfileMembers.removedAt),
        isNotNull(careProfileMembers.acceptedAt),
      ),
    );
  if (rows.length > 1) {
    throw new MultipleProfilesNotSupportedError();
  }
  if (rows.length === 0) {
    return null;
  }
  return rows[0]!;
}

/** All accepted caregivers on a profile (for audit + picker + memory invalidation). */
export async function listHouseholdActorUserIds(
  db: DbWithSchema,
  careProfileId: string,
): Promise<string[]> {
  const rows = await db
    .select({ userId: careProfileMembers.userId })
    .from(careProfileMembers)
    .where(
      and(
        eq(careProfileMembers.careProfileId, careProfileId),
        isNull(careProfileMembers.removedAt),
        isNotNull(careProfileMembers.acceptedAt),
        isNotNull(careProfileMembers.userId),
      ),
    );
  return rows.map((r) => r.userId as string);
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * New `care_profile` rows created after the TASK-038 migration need an owner membership row.
 * Safe to call repeatedly (no-op when an owner already exists).
 */
export async function ensureOwnerMembershipRow(
  db: DbWithSchema,
  args: { careProfileId: string; userId: string },
): Promise<void> {
  const [exists] = await db
    .select({ id: careProfileMembers.id })
    .from(careProfileMembers)
    .where(
      and(
        eq(careProfileMembers.careProfileId, args.careProfileId),
        eq(careProfileMembers.role, "owner"),
        isNull(careProfileMembers.removedAt),
      ),
    )
    .limit(1);
  if (exists != null) {
    return;
  }
  const now = new Date();
  await db.insert(careProfileMembers).values({
    careProfileId: args.careProfileId,
    userId: args.userId,
    inviteeEmail: null,
    role: "owner",
    invitedBy: args.userId,
    invitedAt: now,
    acceptedAt: now,
    removedAt: null,
    shareConversationsWithOtherMembers: false,
    shareSavedAnswersWithOtherMembers: false,
  });
}
