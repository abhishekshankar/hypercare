import "server-only";

import { and, eq, ne } from "drizzle-orm";
import { createDbClient, moduleTopics, modules, topics } from "@alongside/db";

import { serverEnv } from "@/lib/env.server";

import type { LibraryModuleListItem } from "./types";

/**
 * All published modules with topic tags for the library and client-side search.
 */
export async function loadLibraryModuleList(): Promise<LibraryModuleListItem[]> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const rows = await db
    .select({
      m: modules,
      topicSlug: moduleTopics.topicSlug,
      topicDisplay: topics.displayName,
    })
    .from(modules)
    .leftJoin(moduleTopics, eq(modules.id, moduleTopics.moduleId))
    .leftJoin(topics, eq(moduleTopics.topicSlug, topics.slug))
    .where(and(eq(modules.published, true), ne(modules.draftStatus, "retired")));

  const bySlug = new Map<
    string,
    { m: (typeof rows)[0]["m"]; topicTags: { slug: string; displayName: string }[] }
  >();

  for (const r of rows) {
    const slug = r.m.slug;
    if (!bySlug.has(slug)) {
      bySlug.set(slug, { m: r.m, topicTags: [] });
    }
    if (r.topicSlug && r.topicDisplay) {
      const entry = bySlug.get(slug)!;
      if (!entry.topicTags.some((t) => t.slug === r.topicSlug)) {
        entry.topicTags.push({ slug: r.topicSlug, displayName: r.topicDisplay });
      }
    }
  }

  return [...bySlug.values()].map(({ m, topicTags }) => ({
    slug: m.slug,
    title: m.title,
    summary: m.summary,
    category: m.category,
    stageRelevance: m.stageRelevance,
    topicTags,
  }));
}
