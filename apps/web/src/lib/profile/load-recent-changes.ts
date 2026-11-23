import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  careProfile,
  careProfileChanges,
  createDbClient,
  getCareProfileForUser,
  listHouseholdActorUserIds,
  users,
} from "@alongside/db";

import { serverEnv } from "../env.server";

export type ProfileChangeListRow = typeof careProfileChanges.$inferSelect;

export type ProfileChangeListRowWithEditor = ProfileChangeListRow & {
  editorDisplayName: string | null;
  editorEmail: string | null;
};

export async function loadRecentProfileChanges(
  userId: string,
  limit: number,
): Promise<ProfileChangeListRowWithEditor[]> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  let actorIds: string[] = [userId];
  try {
    const bundle = await getCareProfileForUser(db, userId);
    if (bundle != null) {
      const ids = await listHouseholdActorUserIds(db, bundle.profile.id);
      actorIds = ids.length > 0 ? ids : [userId];
    } else {
      const [owned] = await db
        .select({ id: careProfile.id })
        .from(careProfile)
        .where(eq(careProfile.userId, userId))
        .limit(1);
      if (owned == null) {
        return [];
      }
      const ids = await listHouseholdActorUserIds(db, owned.id);
      actorIds = ids.length > 0 ? ids : [userId];
    }
  } catch {
    actorIds = [userId];
  }

  const rows = await db
    .select({
      r: careProfileChanges,
      editorDisplayName: users.displayName,
      editorEmail: users.email,
    })
    .from(careProfileChanges)
    .innerJoin(users, eq(users.id, careProfileChanges.changedBy))
    .where(
      and(inArray(careProfileChanges.changedBy, actorIds), isNotNull(careProfileChanges.changedBy)),
    )
    .orderBy(desc(careProfileChanges.changedAt))
    .limit(limit);

  return rows
    .map((x) => ({
      ...x.r,
      editorDisplayName: x.editorDisplayName,
      editorEmail: x.editorEmail,
    }))
    .slice()
    .reverse();
}
