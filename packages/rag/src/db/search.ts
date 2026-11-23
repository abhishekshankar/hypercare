import { sql } from "drizzle-orm";
import { createDbClient } from "@alongside/db";

import type { RetrievedChunk, Stage } from "../types.js";

/**
 * pgvector cosine ANN search over `module_chunks` + `module_branch_chunks` (SURFACES-06),
 * merged and reranked with a small care-profile fit bonus on branch rows.
 */
export type SearchParams = {
  databaseUrl: string;
  embedding: number[];
  stage: Stage | null;
  relationship: string | null;
  livingSituation: string | null;
  k: number;
};

type SearchRow = {
  chunk_id: string;
  module_id: string;
  module_slug: string;
  module_title: string;
  module_tier: number;
  category: string;
  attribution_line: string;
  section_heading: string | null;
  stage_relevance: string[] | null;
  chunk_index: number;
  content: string;
  distance: string | number;
};

type BranchSearchRow = SearchRow & {
  branch_key: string | null;
  stage_key: string | null;
  relationship_key: string | null;
  living_situation_key: string | null;
};

function vectorLiteral(emb: number[]): string {
  for (const n of emb) {
    if (!Number.isFinite(n)) throw new Error("Embedding contains non-finite value");
  }
  return `[${emb.map((n) => n.toString()).join(",")}]`;
}

function axisFit(
  b: { stage_key: string | null; relationship_key: string | null; living_situation_key: string | null },
  stage: Stage | null,
  relationship: string | null,
  livingSituation: string | null,
): number {
  let n = 0;
  if (stage != null) {
    if (b.stage_key === stage || b.stage_key === "any") n += 1;
  }
  if (relationship != null && relationship !== "") {
    if (b.relationship_key === relationship || b.relationship_key === "any") n += 1;
  }
  const liv = livingSituation ?? "with_caregiver";
  if (b.living_situation_key === liv || b.living_situation_key === "any") n += 1;
  return n;
}

async function searchCanonicalChunks(
  databaseUrl: string,
  embedding: number[],
  stage: Stage | null,
  k: number,
): Promise<RetrievedChunk[]> {
  const db = createDbClient(databaseUrl);
  const lit = vectorLiteral(embedding);
  const vec = sql`${sql.raw(`'${lit}'::vector(${embedding.length})`)}`;

  const stageFilter = stage
    ? sql`AND (
        jsonb_typeof(mc.metadata->'stage_relevance') = 'array'
        AND (
          jsonb_array_length(mc.metadata->'stage_relevance') = 0
          OR mc.metadata->'stage_relevance' @> to_jsonb(${stage}::text)
        )
      )`
    : sql``;

  const rows = (await db.execute(sql`
    SELECT
      mc.id              AS chunk_id,
      mc.module_id       AS module_id,
      m.slug             AS module_slug,
      m.title            AS module_title,
      m.tier             AS module_tier,
      m.category         AS category,
      m.attribution_line AS attribution_line,
      mc.metadata->>'section_heading' AS section_heading,
      CASE
        WHEN jsonb_typeof(mc.metadata->'stage_relevance') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(mc.metadata->'stage_relevance'))
        ELSE NULL
      END AS stage_relevance,
      mc.chunk_index     AS chunk_index,
      mc.content         AS content,
      (mc.embedding <=> ${vec}) AS distance
    FROM module_chunks mc
    JOIN modules m ON m.id = mc.module_id
    WHERE m.published = true
    ${stageFilter}
    ORDER BY mc.embedding <=> ${vec}
    LIMIT ${k}
  `)) as unknown as SearchRow[];

  return rows.map((r) => ({
    chunkId: r.chunk_id,
    moduleId: r.module_id,
    moduleSlug: r.module_slug,
    moduleTitle: r.module_title,
    moduleTier: r.module_tier,
    category: r.category,
    attributionLine: r.attribution_line,
    sectionHeading: r.section_heading ?? "",
    stageRelevance: r.stage_relevance ?? [],
    chunkIndex: r.chunk_index,
    content: r.content,
    distance: typeof r.distance === "string" ? Number(r.distance) : r.distance,
    branchKey: null,
  }));
}

async function searchBranchChunks(
  databaseUrl: string,
  embedding: number[],
  stage: Stage | null,
  relationship: string | null,
  livingSituation: string | null,
  k: number,
): Promise<RetrievedChunk[]> {
  const db = createDbClient(databaseUrl);
  const lit = vectorLiteral(embedding);
  const vec = sql`${sql.raw(`'${lit}'::vector(${embedding.length})`)}`;

  const stageFilter = stage
    ? sql`AND (mb.stage_key = 'any' OR mb.stage_key = ${stage}::text)`
    : sql``;
  const relFilter =
    relationship != null && relationship !== ""
      ? sql`AND (mb.relationship_key = 'any' OR mb.relationship_key = ${relationship}::text)`
      : sql``;
  const liv = livingSituation ?? "with_caregiver";
  const livFilter = sql`AND (mb.living_situation_key = 'any' OR mb.living_situation_key = ${liv}::text)`;

  const rows = (await db.execute(sql`
    SELECT
      mbc.id             AS chunk_id,
      mbc.module_id      AS module_id,
      m.slug             AS module_slug,
      m.title            AS module_title,
      m.tier             AS module_tier,
      m.category         AS category,
      m.attribution_line AS attribution_line,
      mbc.metadata->>'section_heading' AS section_heading,
      CASE
        WHEN jsonb_typeof(mbc.metadata->'stage_relevance') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(mbc.metadata->'stage_relevance'))
        ELSE NULL
      END AS stage_relevance,
      mbc.chunk_index    AS chunk_index,
      mbc.content        AS content,
      (mbc.embedding <=> ${vec}) AS distance,
      mbc.metadata->>'branch_key' AS branch_key,
      mb.stage_key       AS stage_key,
      mb.relationship_key AS relationship_key,
      mb.living_situation_key AS living_situation_key
    FROM module_branch_chunks mbc
    JOIN module_branches mb ON mb.id = mbc.branch_id
    JOIN modules m ON m.id = mbc.module_id
    WHERE m.published = true
    ${stageFilter}
    ${relFilter}
    ${livFilter}
    ORDER BY mbc.embedding <=> ${vec}
    LIMIT ${k}
  `)) as unknown as BranchSearchRow[];

  return rows.map((r) => {
    const fit = axisFit(
      {
        stage_key: r.stage_key,
        relationship_key: r.relationship_key,
        living_situation_key: r.living_situation_key,
      },
      stage,
      relationship,
      livingSituation,
    );
    const d = typeof r.distance === "string" ? Number(r.distance) : r.distance;
    const adjusted = d - 0.015 * fit;
    return {
      chunkId: r.chunk_id,
      moduleId: r.module_id,
      moduleSlug: r.module_slug,
      moduleTitle: r.module_title,
      moduleTier: r.module_tier,
      category: r.category,
      attributionLine: r.attribution_line,
      sectionHeading: r.section_heading ?? "",
      stageRelevance: r.stage_relevance ?? [],
      chunkIndex: r.chunk_index,
      content: r.content,
      distance: adjusted,
      branchKey: r.branch_key ?? null,
    };
  });
}

function mergeByDistance(a: RetrievedChunk[], b: RetrievedChunk[], k: number): RetrievedChunk[] {
  const merged = [...a, ...b].sort((x, y) => x.distance - y.distance);
  const seen = new Set<string>();
  const out: RetrievedChunk[] = [];
  for (const c of merged) {
    const key = `${c.moduleId}\0${c.chunkId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= k) break;
  }
  return out;
}

export async function searchChunks(params: SearchParams): Promise<RetrievedChunk[]> {
  const { databaseUrl, embedding, stage, relationship, livingSituation, k } = params;
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error(`searchChunks: invalid k ${String(k)}`);
  }
  const half = Math.max(2, Math.ceil(k / 2));
  const [canonical, branch] = await Promise.all([
    searchCanonicalChunks(databaseUrl, embedding, stage, half),
    searchBranchChunks(databaseUrl, embedding, stage, relationship, livingSituation, half),
  ]);
  return mergeByDistance(canonical, branch, k);
}
