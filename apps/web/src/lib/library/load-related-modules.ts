import { and, eq, inArray, isNotNull } from "drizzle-orm";
import {
  createDbClient,
  lessonProgress,
  moduleRelations,
  modules,
} from "@alongside/db";

import { serverEnv } from "@/lib/env.server";

export type RelatedEdge = {
  relationType: "prerequisite" | "follow_up" | "deeper" | "contradicts" | "soft_flag_companion";
  toSlug: string;
  toTitle: string;
  read: boolean;
};

export async function loadRelatedModulesForSlug(
  slug: string,
  opts?: { userId?: string },
): Promise<RelatedEdge[]> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [from] = await db.select({ id: modules.id }).from(modules).where(eq(modules.slug, slug)).limit(1);
  if (!from) return [];

  const rows = await db
    .select({
      relationType: moduleRelations.relationType,
      toSlug: modules.slug,
      toTitle: modules.title,
      toId: modules.id,
    })
    .from(moduleRelations)
    .innerJoin(modules, eq(moduleRelations.toModuleId, modules.id))
    .where(eq(moduleRelations.fromModuleId, from.id));

  const filtered = rows.filter((r) => r.relationType !== "soft_flag_companion");
  if (filtered.length === 0 || !opts?.userId) {
    return filtered.map((r) => ({
      relationType: r.relationType as RelatedEdge["relationType"],
      toSlug: r.toSlug,
      toTitle: r.toTitle,
      read: false,
    }));
  }

  const ids = [...new Set(filtered.map((r) => r.toId))];
  const done = await db
    .select({ moduleId: lessonProgress.moduleId })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, opts.userId),
        inArray(lessonProgress.moduleId, ids),
        isNotNull(lessonProgress.completedAt),
      ),
    );
  const readSet = new Set(done.map((d) => d.moduleId));

  return filtered.map((r) => ({
    relationType: r.relationType as RelatedEdge["relationType"],
    toSlug: r.toSlug,
    toTitle: r.toTitle,
    read: readSet.has(r.toId),
  }));
}
