import { asc, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { selectHeavyBranchMarkdown, type CareProfileAxes } from "@alongside/content";
import {
  careProfile,
  createDbClient,
  moduleBranches,
  moduleTools,
  moduleTopics,
  modules,
  topics,
} from "@alongside/db";

import { serverEnv } from "@/lib/env.server";

import { type BranchAxes, parseBranchKeyParam } from "./branch-labels";
import { CATEGORY_SECTION_TITLES, type LibraryCategory } from "./constants";

export type ModuleToolRow = {
  id: string;
  toolType: string;
  slug: string;
  title: string;
  payload: unknown;
};

export type ModulePagePayload = {
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
  heavy: boolean;
  /** Populated for heavy modules: all branch axes (for picker). */
  branches: BranchAxes[];
  /** The branch whose body is in `bodyMd`. */
  pickedBranch: BranchAxes | null;
  tools: ModuleToolRow[];
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

function rowToAxes(b: InferSelectModel<typeof moduleBranches>): BranchAxes {
  return {
    stageKey: b.stageKey,
    relationshipKey: b.relationshipKey,
    livingSituationKey: b.livingSituationKey,
  };
}

export async function loadModuleBySlug(
  slug: string,
  opts?: { userId?: string; branchParam?: string | null },
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

  const toolRows = await db
    .select({
      id: moduleTools.id,
      toolType: moduleTools.toolType,
      slug: moduleTools.slug,
      title: moduleTools.title,
      payload: moduleTools.payload,
    })
    .from(moduleTools)
    .where(eq(moduleTools.moduleId, m.id))
    .orderBy(asc(moduleTools.createdAt));

  const tools: ModuleToolRow[] = toolRows.map((t) => ({
    id: t.id,
    toolType: t.toolType,
    slug: t.slug,
    title: t.title,
    payload: t.payload,
  }));

  let bodyMd = m.bodyMd;
  let branches: BranchAxes[] = [];
  let pickedBranch: BranchAxes | null = null;

  if (m.heavy) {
    const brs = await db.select().from(moduleBranches).where(eq(moduleBranches.moduleId, m.id));
    branches = brs.map(rowToAxes);

    const override = opts?.branchParam ? parseBranchKeyParam(opts.branchParam) : null;
    const overrideRow =
      override != null
        ? brs.find(
            (b) =>
              b.stageKey === override.stageKey &&
              b.relationshipKey === override.relationshipKey &&
              b.livingSituationKey === override.livingSituationKey,
          )
        : undefined;

    if (overrideRow) {
      bodyMd = overrideRow.bodyMd;
      pickedBranch = rowToAxes(overrideRow);
    } else if (opts?.userId) {
      const [cp] = await db.select().from(careProfile).where(eq(careProfile.userId, opts.userId)).limit(1);
      if (cp && brs.length > 0) {
        const axes = toCareAxes(cp);
        const { bodyMd: picked, branch } = selectHeavyBranchMarkdown(
          brs.map((b) => ({
            stageKey: b.stageKey,
            relationshipKey: b.relationshipKey,
            livingSituationKey: b.livingSituationKey,
            bodyMd: b.bodyMd,
          })),
          axes,
        );
        bodyMd = picked;
        pickedBranch = {
          stageKey: branch.stageKey,
          relationshipKey: branch.relationshipKey,
          livingSituationKey: branch.livingSituationKey,
        };
      } else if (brs.length > 0) {
        const fb = brs.find((b) => b.stageKey === "any" && b.relationshipKey === "any" && b.livingSituationKey === "any") ?? brs[0]!;
        bodyMd = fb.bodyMd;
        pickedBranch = rowToAxes(fb);
      }
    } else if (brs.length > 0) {
      const fb = brs.find((b) => b.stageKey === "any" && b.relationshipKey === "any" && b.livingSituationKey === "any") ?? brs[0]!;
      bodyMd = fb.bodyMd;
      pickedBranch = rowToAxes(fb);
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
    heavy: m.heavy,
    branches,
    pickedBranch,
    tools,
  };
}
