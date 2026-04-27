import "server-only";

import { createDbClient, listHouseholdActorUserIds } from "@alongside/db";

import { serverEnv } from "../env.server";

/** Caregivers whose conversation memory should invalidate after a shared profile edit. */
export async function loadHouseholdMemoryUserIds(careProfileId: string): Promise<string[]> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const ids = await listHouseholdActorUserIds(db, careProfileId);
  return ids.length > 0 ? ids : [];
}
