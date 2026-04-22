import { eq } from "drizzle-orm";
import { createDbClient, moduleTopics, modules, topics } from "@hypercare/db";

import { serverEnv } from "@/lib/env.server";

import { CATEGORY_SECTION_TITLES, type LibraryCategory } from "./constants";

export type ModulePagePayload = {
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

export async function loadModuleBySlug(
  slug: string,
): Promise<ModulePagePayload | null> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [m] = await db.select().from(modules).where(eq(modules.slug, slug)).limit(1);
  if (!m || !m.published) return null;

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

  return {
    slug: m.slug,
    title: m.title,
    bodyMd: m.bodyMd,
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
