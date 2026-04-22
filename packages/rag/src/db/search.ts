import { sql } from "drizzle-orm";
import { createDbClient } from "@hypercare/db";

import type { RetrievedChunk, Stage } from "../types.js";

/**
 * pgvector cosine ANN search over `module_chunks`, filtered by:
 *   - parent module is `published = true`
 *   - stage filter (when stage != null): metadata.stage_relevance contains
 *     the stage OR is the empty array (stage-agnostic content always passes).
 *
 * The `<=>` operator matches the HNSW index's `vector_cosine_ops` opclass
 * (see `packages/db/src/schema/module-chunks.ts`). pgvector returns distance
 * in [0, 2] for cosine; lower is better.
 *
 * The vector literal is built from a sanitized number array; we do not
 * interpolate user text. `inline parameter` is required because pgvector
 * does not bind `vector` types via JS prepared statements cleanly with
 * postgres-js + drizzle today.
 */
export type SearchParams = {
  databaseUrl: string;
  embedding: number[];
  stage: Stage | null;
  k: number;
};

type SearchRow = {
  chunk_id: string;
  module_id: string;
  module_slug: string;
  module_title: string;
  category: string;
  attribution_line: string;
  section_heading: string | null;
  stage_relevance: string[] | null;
  chunk_index: number;
  content: string;
  distance: string | number;
};

function vectorLiteral(emb: number[]): string {
  for (const n of emb) {
    if (!Number.isFinite(n)) throw new Error("Embedding contains non-finite value");
  }
  return `[${emb.map((n) => n.toString()).join(",")}]`;
}

export async function searchChunks(params: SearchParams): Promise<RetrievedChunk[]> {
  const { databaseUrl, embedding, stage, k } = params;
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error(`searchChunks: invalid k ${String(k)}`);
  }
  const db = createDbClient(databaseUrl);
  const lit = vectorLiteral(embedding);
  // sql.raw(lit) is safe: lit is built only from validated numbers above.
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
    category: r.category,
    attributionLine: r.attribution_line,
    sectionHeading: r.section_heading ?? "",
    stageRelevance: r.stage_relevance ?? [],
    chunkIndex: r.chunk_index,
    content: r.content,
    distance: typeof r.distance === "string" ? Number(r.distance) : r.distance,
  }));
}
