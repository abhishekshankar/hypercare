import { and, eq, inArray } from "drizzle-orm";
import { createDbClient, moduleRelations, moduleTopics, modules } from "@alongside/db";

import { serverEnv } from "@/lib/env.server";

const BURNOUT_TOPICS = ["caregiver-burnout", "guilt-and-grief", "self-care"] as const;

export type WarmCompanionModule = {
  slug: string;
  title: string;
  tryThisToday: string | null;
};

/**
 * When burnout soft flags are elevated, surface a companion module linked via
 * `soft_flag_companion` edges to burnout-related topics (SURFACES-05).
 */
export async function loadBurnoutWarmCompanionModule(): Promise<WarmCompanionModule | null> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const rows = await db
    .select({
      slug: modules.slug,
      title: modules.title,
      tryThisToday: modules.tryThisToday,
    })
    .from(moduleRelations)
    .innerJoin(modules, eq(modules.id, moduleRelations.fromModuleId))
    .innerJoin(moduleTopics, eq(moduleTopics.moduleId, moduleRelations.toModuleId))
    .where(
      and(
        eq(moduleRelations.relationType, "soft_flag_companion"),
        inArray(moduleTopics.topicSlug, [...BURNOUT_TOPICS]),
        eq(modules.published, true),
      ),
    )
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return { slug: r.slug, title: r.title, tryThisToday: r.tryThisToday };
}
