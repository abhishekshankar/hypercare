import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import {
  createDbClient,
  moduleBranches,
  moduleEvidence,
  moduleRelations,
  moduleTools,
  modules,
} from "@alongside/db";
import { chunkModuleBody } from "../chunk.js";
import { moduleFrontMatterSchema, type HeavyDiskFrontmatter, type ModuleFrontMatter } from "../schema.js";
import {
  loadExistingChunkMap,
  replaceModuleBranchChunkRowsInTx,
  replaceModuleChunkRowsInTx,
  resolveEmbeddings,
} from "../upsert.js";
import {
  type HeavyEvidenceRow,
  type ParsedHeavyModule,
  parseHeavyModuleFromDisk,
} from "./parse-heavy-module-from-disk.js";
import { validateHeavyModule } from "./validate-heavy-module.js";

function categoryForRelationStub(slug: string): (typeof modules.$inferInsert)["category"] {
  if (slug.startsWith("medical-")) return "medical";
  if (slug.startsWith("self-care-")) return "caring_for_yourself";
  if (slug.startsWith("legal-")) return "legal_financial";
  if (slug.startsWith("transitions-")) return "transitions";
  return "medical";
}

/** `module_evidence.source_type` CHECK allows only these values (migration `0008_content_authoring_workflow`). Hermes `source_id` is not the same column. */
function evidenceSourceTypeForDb(row: HeavyEvidenceRow): "url" | "book" | "paper" | "intervention" | "pac" {
  if (row.url?.trim()) return "url";
  return "paper";
}

async function readUrlSnapshot(repoRoot: string, snapshotPath?: string): Promise<string | null> {
  if (!snapshotPath?.trim()) return null;
  const rel = snapshotPath.trim();
  const abs = rel.startsWith("packages/")
    ? path.join(repoRoot, rel)
    : path.join(repoRoot, "packages", "content", rel);
  try {
    const buf = await readFile(abs);
    const t = buf.toString("utf8");
    return t.length > 200_000 ? t.slice(0, 200_000) : t;
  } catch {
    return null;
  }
}

async function ensureRelationTargets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle tx
  tx: any,
  missingSlugs: readonly string[],
): Promise<void> {
  for (const slug of missingSlugs) {
    const category = categoryForRelationStub(slug);
    await tx
      .insert(modules)
      .values({
        slug,
        title: slug,
        category,
        stageRelevance: ["early"],
        tier: 2,
        summary: "Placeholder module for Hermes relation targets (stub row).",
        bodyMd: `# ${slug}\n\n_Stub — full module content pending._\n`,
        attributionLine: "Internal stub for relation graph integrity.",
        expertReviewer: null,
        reviewDate: null,
        nextReviewDue: null,
        tryThisToday: null,
        heavy: false,
        bundleVersion: 1,
        srsSuitable: true,
        srsDifficultyBucket: null,
        weeksFocusEligible: true,
        softFlagCompanionFor: [],
        secondaryTopics: [],
        primaryTopics: [],
        published: false,
        draftStatus: "draft",
        lastPublishedAt: null,
      })
      .onConflictDoNothing({ target: modules.slug });
  }
}

function topicUnion(front: HeavyDiskFrontmatter): string[] {
  const sec = front.secondary_topics ?? [];
  return [...new Set([...front.topics, ...sec])];
}

function branchAxesKey(b: { stageKey: string; relationshipKey: string; livingSituationKey: string }): string {
  return `${b.stageKey}\0${b.relationshipKey}\0${b.livingSituationKey}`;
}

function toEmbedFront(front: HeavyDiskFrontmatter): ModuleFrontMatter {
  const tu = topicUnion(front);
  const topics = tu.slice(0, 4);
  if (topics.length < 2) {
    throw new Error("need at least 2 topic slugs for embedding front-matter");
  }
  return moduleFrontMatterSchema.parse({
    slug: front.slug,
    title: front.title,
    category: front.category,
    tier: front.tier,
    stage_relevance: front.stage_relevance,
    summary: front.summary,
    attribution_line: front.attribution_line,
    expert_reviewer: front.expert_reviewer,
    review_date: front.review_date,
    topics,
    try_this_today: front.try_this_today,
  });
}

export async function publishHeavyModulePayload(
  parsed: ParsedHeavyModule,
  args: { repoRoot: string; databaseUrl: string; seedRelationTargets?: boolean },
): Promise<{ moduleId: string; chunkCount: number; warnings: string[] }> {
  const db = createDbClient(args.databaseUrl);

  const edgeSlugs = parsed.relations.edges.map((e) => e.to_module_slug);
  const existingRows = await db.select({ slug: modules.slug }).from(modules).where(inArray(modules.slug, edgeSlugs));
  const slugSet = new Set(existingRows.map((r) => r.slug));
  const [selfHit] = await db.select({ slug: modules.slug }).from(modules).where(eq(modules.slug, parsed.front.slug)).limit(1);
  if (selfHit) slugSet.add(selfHit.slug);

  const missing = edgeSlugs.filter((s) => !slugSet.has(s));
  if (missing.length > 0 && args.seedRelationTargets) {
    await db.transaction(async (tx) => {
      await ensureRelationTargets(tx, missing);
    });
    const again = await db.select({ slug: modules.slug }).from(modules).where(inArray(modules.slug, edgeSlugs));
    for (const r of again) slugSet.add(r.slug);
  }

  const { errors: valErrors, warnings: valWarnings } = validateHeavyModule(parsed, slugSet);
  if (valErrors.length > 0) {
    throw new Error(`heavy module validation failed:\n${valErrors.join("\n")}`);
  }

  const front = parsed.front;
  const bundleVersion = front.bundle_version ?? 1;
  const primaryTopicsJson = front.primary_topics ?? front.topics;
  const secondaryTopicsJson = front.secondary_topics ?? [];
  const softFlag = front.soft_flag_companion_for ?? [];
  const srsBucket =
    front.srs_difficulty_bucket === null || front.srs_difficulty_bucket === undefined
      ? null
      : front.srs_difficulty_bucket;

  const embedFront = toEmbedFront(front);
  const chunks = chunkModuleBody(parsed.bodyMd);
  const { byIndex } = await loadExistingChunkMap(args.databaseUrl, parsed.front.slug);
  const embeddings = await resolveEmbeddings(byIndex, { front: embedFront, body: parsed.bodyMd, chunks }, () => {});

  const branchEmbedByAxes = new Map<
    string,
    { chunks: ReturnType<typeof chunkModuleBody>; embeddings: number[][] }
  >();
  for (const b of parsed.branches) {
    const bChunks = chunkModuleBody(b.bodyMd);
    const bEmb = await resolveEmbeddings(
      new Map() as Parameters<typeof resolveEmbeddings>[0],
      { front: embedFront, body: b.bodyMd, chunks: bChunks },
      () => {},
    );
    branchEmbedByAxes.set(branchAxesKey(b), { chunks: bChunks, embeddings: bEmb });
  }

  return await db.transaction(async (tx) => {
    const now = new Date();
    const [mRow] = await tx
      .insert(modules)
      .values({
        slug: front.slug,
        title: front.title,
        category: front.category,
        stageRelevance: front.stage_relevance,
        tier: front.tier,
        summary: front.summary,
        bodyMd: parsed.bodyMd,
        attributionLine: front.attribution_line,
        expertReviewer: front.expert_reviewer,
        reviewDate: front.review_date,
        nextReviewDue: null,
        tryThisToday: front.try_this_today ?? null,
        heavy: true,
        bundleVersion,
        srsSuitable: front.srs_suitable ?? true,
        srsDifficultyBucket: srsBucket,
        weeksFocusEligible: front.weeks_focus_eligible ?? true,
        softFlagCompanionFor: softFlag,
        secondaryTopics: secondaryTopicsJson,
        primaryTopics: primaryTopicsJson,
        published: true,
        draftStatus: "published",
        lastPublishedAt: now,
      })
      .onConflictDoUpdate({
        target: modules.slug,
        set: {
          title: sql`excluded."title"`,
          category: sql`excluded."category"`,
          stageRelevance: sql`excluded."stage_relevance"`,
          tier: sql`excluded."tier"`,
          summary: sql`excluded."summary"`,
          bodyMd: sql`excluded."body_md"`,
          attributionLine: sql`excluded."attribution_line"`,
          expertReviewer: sql`excluded."expert_reviewer"`,
          reviewDate: sql`excluded."review_date"`,
          nextReviewDue: sql`excluded."next_review_due"`,
          tryThisToday: sql`excluded."try_this_today"`,
          heavy: sql`excluded."heavy"`,
          bundleVersion: sql`excluded."bundle_version"`,
          srsSuitable: sql`excluded."srs_suitable"`,
          srsDifficultyBucket: sql`excluded."srs_difficulty_bucket"`,
          weeksFocusEligible: sql`excluded."weeks_focus_eligible"`,
          softFlagCompanionFor: sql`excluded."soft_flag_companion_for"`,
          secondaryTopics: sql`excluded."secondary_topics"`,
          primaryTopics: sql`excluded."primary_topics"`,
          published: sql`excluded."published"`,
          draftStatus: sql`excluded."draft_status"`,
          lastPublishedAt: sql`excluded."last_published_at"`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: modules.id });

    const moduleId = mRow?.id;
    if (!moduleId) throw new Error("module upsert returned no id");

    await tx.delete(moduleBranches).where(eq(moduleBranches.moduleId, moduleId));
    await tx.delete(moduleTools).where(eq(moduleTools.moduleId, moduleId));
    await tx.delete(moduleRelations).where(eq(moduleRelations.fromModuleId, moduleId));
    await tx.delete(moduleEvidence).where(eq(moduleEvidence.moduleId, moduleId));

    let insertedBranches: {
      id: string;
      stageKey: string;
      relationshipKey: string;
      livingSituationKey: string;
    }[] = [];
    if (parsed.branches.length > 0) {
      insertedBranches = await tx
        .insert(moduleBranches)
        .values(
          parsed.branches.map((b) => ({
            moduleId,
            stageKey: b.stageKey,
            relationshipKey: b.relationshipKey,
            livingSituationKey: b.livingSituationKey,
            bodyMd: b.bodyMd,
          })),
        )
        .returning({
          id: moduleBranches.id,
          stageKey: moduleBranches.stageKey,
          relationshipKey: moduleBranches.relationshipKey,
          livingSituationKey: moduleBranches.livingSituationKey,
        });
    }

    const branchPlans = insertedBranches.map((row) => {
      const pack = branchEmbedByAxes.get(branchAxesKey(row));
      if (!pack) {
        throw new Error(`missing branch embedding pack for axes ${branchAxesKey(row)}`);
      }
      return {
        branchId: row.id,
        stageKey: row.stageKey,
        relationshipKey: row.relationshipKey,
        livingSituationKey: row.livingSituationKey,
        chunks: pack.chunks,
        embeddings: pack.embeddings,
      };
    });
    const nBranch =
      branchPlans.length > 0 ? await replaceModuleBranchChunkRowsInTx(tx, moduleId, embedFront, branchPlans) : 0;

    if (parsed.tools.length > 0) {
      await tx.insert(moduleTools).values(
        parsed.tools.map((t) => ({
          moduleId,
          toolType: t.toolType,
          slug: t.slug,
          title: t.title,
          payload: t.payload as Record<string, unknown>,
        })),
      );
    }

    const slugToId = new Map<string, string>();
    const allSlugs = [...new Set([front.slug, ...edgeSlugs])];
    const idRows = await tx.select({ id: modules.id, slug: modules.slug }).from(modules).where(inArray(modules.slug, allSlugs));
    for (const r of idRows) slugToId.set(r.slug, r.id);

    const fromId = slugToId.get(front.slug);
    if (!fromId) throw new Error("from module id not resolved");
    const relRows = parsed.relations.edges
      .map((e) => {
        const toId = slugToId.get(e.to_module_slug);
        if (!toId) return null;
        return { fromModuleId: fromId, toModuleId: toId, relationType: e.relation_type };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
    if (relRows.length > 0) {
      await tx.insert(moduleRelations).values(relRows);
    }

    for (const row of parsed.evidence) {
      const snap = await readUrlSnapshot(args.repoRoot, row.url_snapshot_path);
      await tx.insert(moduleEvidence).values({
        moduleId,
        sourceTier: row.tier,
        sourceType: evidenceSourceTypeForDb(row),
        citation: row.claim_text,
        url: row.url,
        quotedSupport: row.quoted_excerpt,
        quotedExcerpt: row.quoted_excerpt,
        urlSnapshot: snap,
        claimAnchor: row.claim_anchor,
        addedBy: null,
      });
    }

    const n = await replaceModuleChunkRowsInTx(tx, moduleId, { front: embedFront, body: parsed.bodyMd, chunks }, embeddings, {
      topicSlugs: topicUnion(front),
    });
    return { moduleId, chunkCount: n + nBranch, warnings: valWarnings };
  });
}

export async function publishHeavyModuleFromDisk(args: {
  repoRoot: string;
  slug: string;
  databaseUrl: string;
  seedRelationTargets?: boolean;
}): Promise<{ moduleId: string; chunkCount: number; warnings: string[] }> {
  const parsed = await parseHeavyModuleFromDisk({ repoRoot: args.repoRoot, slug: args.slug });
  return publishHeavyModulePayload(parsed, args);
}
