import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { selectHeavyBranchMarkdown, type CareProfileAxes } from "@alongside/content";
import { careProfile, createDbClient, moduleBranches, moduleTopics, modules, topics } from "@alongside/db";

import { serverEnv } from "@/lib/env.server";

import { CATEGORY_SECTION_TITLES, type LibraryCategory } from "./constants";

export type ModulePagePayload = {
  /** `modules.id` (TASK-040: SSE `started` + stream telemetry). */
  id: string;
  slug: string;
  title: string;
  bodyMd: string;
  category: string;
  categoryLabel: string;
  stageRelevance: string[];
  summary: string;
  attributionLine: string;
  expertReviewer: string | null;
  reviewDate: string | null;
  tryThisToday: string | null;
  topicTags: { slug: string; displayName: string }[];
};

function categoryLabel(c: string): string {
  if ((Object.keys(CATEGORY_SECTION_TITLES) as string[]).includes(c)) {
    return CATEGORY_SECTION_TITLES[c as LibraryCategory];
  }
  return c;
}

function toCareAxes(row: InferSelectModel<typeof careProfile>): CareProfileAxes {
  const st = row.inferredStage;
  const stage: CareProfileAxes["stage"] =
    st === "early" || st === "middle" || st === "late" ? st : "unknown";
  const relationship = row.crRelationship as CareProfileAxes["relationship"];
  const livingSituation = (row.livingSituation ?? "with_caregiver") as CareProfileAxes["livingSituation"];
  return { stage, relationship, livingSituation };
}

export async function loadModuleBySlug(
  slug: string,
  opts?: { userId?: string },
): Promise<ModulePagePayload | null> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [m] = await db.select().from(modules).where(eq(modules.slug, slug)).limit(1);
  if (!m || !m.published || m.draftStatus === "retired") return null;

  const trows = await db
    .select({ slug: topics.slug, displayName: topics.displayName })
    .from(moduleTopics)
    .innerJoin(topics, eq(moduleTopics.topicSlug, topics.slug))
    .where(eq(moduleTopics.moduleId, m.id));

  const reviewDateStr =
    m.reviewDate === null
      ? null
      : typeof m.reviewDate === "string"
        ? m.reviewDate
        : (m.reviewDate as Date).toISOString().slice(0, 10);

  let bodyMd = m.bodyMd;
  if (m.heavy && opts?.userId) {
    const [cp] = await db.select().from(careProfile).where(eq(careProfile.userId, opts.userId)).limit(1);
    if (cp) {
      const brs = await db.select().from(moduleBranches).where(eq(moduleBranches.moduleId, m.id));
      if (brs.length > 0) {
        const axes = toCareAxes(cp);
        const { bodyMd: picked } = selectHeavyBranchMarkdown(
          brs.map((b) => ({
            stageKey: b.stageKey,
            relationshipKey: b.relationshipKey,
            livingSituationKey: b.livingSituationKey,
            bodyMd: b.bodyMd,
          })),
          axes,
        );
        bodyMd = picked;
      }
    }
  }

  return {
    id: m.id,
    slug: m.slug,
    title: m.title,
    bodyMd,
    category: m.category,
    categoryLabel: categoryLabel(m.category),
    stageRelevance: m.stageRelevance,
    summary: m.summary,
    attributionLine: m.attributionLine,
    expertReviewer: m.expertReviewer,
    reviewDate: reviewDateStr,
    tryThisToday: m.tryThisToday,
    topicTags: trows.map((r) => ({ slug: r.slug, displayName: r.displayName })),
  };
}
