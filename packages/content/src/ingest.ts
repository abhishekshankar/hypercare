import { eq, max } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { createDbClient, moduleReviews, moduleTopics, modules, moduleVersions } from "@hypercare/db";
import { chunkModuleBody } from "./chunk.js";
import { loadExistingChunkMap, replaceModuleChunkRowsInTx, resolveEmbeddings, type Embeddable } from "./upsert.js";
import { moduleFrontMatterSchema, type ModuleFrontMatter } from "./schema.js";
import { assertCanCallPublish, canPublishForCategory, type DraftStatus } from "./workflow.js";
import { isAppRole, type AppRole } from "./app-role.js";

type ModuleRow = InferSelectModel<typeof modules>;

/**
 * Reconstruct front-matter + topics for the shared chunk/embedding path from DB rows.
 */
export function buildModuleFrontMatterFromModuleRow(
  m: ModuleRow,
  topicSlugs: string[],
): ModuleFrontMatter {
  return moduleFrontMatterSchema.parse({
    slug: m.slug,
    title: m.title,
    category: m.category,
    tier: m.tier,
    stage_relevance: m.stageRelevance as ("early" | "middle" | "late")[],
    summary: m.summary,
    attribution_line: m.attributionLine,
    expert_reviewer: m.expertReviewer,
    review_date: m.reviewDate
      ? typeof m.reviewDate === "string"
        ? m.reviewDate.slice(0, 10)
        : (m.reviewDate as Date).toISOString().slice(0, 10)
      : null,
    topics: topicSlugs,
    try_this_today: m.tryThisToday ?? undefined,
  });
}

/**
 * Re-chunk, re-embed, snapshot version, and mark module published — **after** embeddings succeed.
 * Caller should use a privileged DB URL in production (same contract as the disk `load` tool).
 */
export async function publishModuleFromDatabase(args: {
  databaseUrl: string;
  moduleId: string;
  currentDraftStatus: DraftStatus;
  appUserRole: string;
  publishedBy: string;
}): Promise<{ version: number; chunkCount: number }> {
  if (args.currentDraftStatus !== "approved") {
    throw new Error("publish requires draft_status = approved");
  }
  if (!isAppRole(args.appUserRole)) {
    throw new Error("Invalid app user role for publish");
  }
  const role: AppRole = args.appUserRole;
  assertCanCallPublish("approved", role);
  const db = createDbClient(args.databaseUrl);
  const [m] = await db.select().from(modules).where(eq(modules.id, args.moduleId)).limit(1);
  if (!m) {
    throw new Error("module not found");
  }
  const topicRows = await db
    .select({ slug: moduleTopics.topicSlug })
    .from(moduleTopics)
    .where(eq(moduleTopics.moduleId, m.id));
  const topicSlugs = topicRows.map((r) => r.slug);
  const reviewRows = await db
    .select({ reviewRole: moduleReviews.reviewRole, verdict: moduleReviews.verdict })
    .from(moduleReviews)
    .where(eq(moduleReviews.moduleId, m.id));
  const g = canPublishForCategory(m.category, reviewRows);
  if (!g.ok) {
    throw new Error(g.message);
  }
  const front = buildModuleFrontMatterFromModuleRow(m, topicSlugs);
  const body = m.bodyMd;
  const input: Embeddable = { front, body, chunks: chunkModuleBody(body) };
  const { byIndex } = await loadExistingChunkMap(args.databaseUrl, m.slug);
  const logSkip = (n: number) => {
    void n;
  };
  const embeddings = await resolveEmbeddings(byIndex, input, logSkip);
  return await db.transaction(async (tx) => {
    const [verRow] = await tx
      .select({ n: max(moduleVersions.version) })
      .from(moduleVersions)
      .where(eq(moduleVersions.moduleId, m.id));
    const nextVersion = (verRow?.n ?? 0) + 1;
    await tx.insert(moduleVersions).values({
      moduleId: m.id,
      version: nextVersion,
      bodyMd: m.bodyMd,
      tryThisToday: m.tryThisToday,
      summary: m.summary,
      publishedBy: args.publishedBy,
    });
    const now = new Date();
    await tx
      .update(modules)
      .set({
        bodyMd: m.bodyMd,
        summary: m.summary,
        tryThisToday: m.tryThisToday,
        published: true,
        draftStatus: "published",
        lastPublishedAt: now,
        updatedAt: now,
      })
      .where(eq(modules.id, m.id));
    const nChunks = await replaceModuleChunkRowsInTx(tx, m.id, input, embeddings);
    return { version: nextVersion, chunkCount: nChunks };
  });
}

export { runLoad as runIngestAllModulesFromDisk } from "./cli.js";
