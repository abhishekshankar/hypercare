import { createHash } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { createDbClient, moduleChunks, moduleTopics, modules } from "@hypercare/db";
import { buildEmbeddingText, embedTitanV2 } from "./embed.js";
import type { ModuleFrontMatter } from "./schema.js";
import type { TextChunk } from "./chunk.js";

export function contentHashForChunk(moduleTitle: string, chunkContent: string): string {
  return createHash("sha256")
    .update(`${moduleTitle}\n${chunkContent}`, "utf8")
    .digest("hex");
}

type ChunkMetadata = {
  section_heading: string;
  stage_relevance: readonly string[];
  content_hash: string;
  [k: string]: unknown;
};

function toVectorColumn(emb: number[]) {
  if (emb.length !== 1024) {
    throw new Error(`Embedding dimension must be 1024, got ${String(emb.length)}`);
  }
  for (const n of emb) {
    if (!Number.isFinite(n)) {
      throw new Error("Embedding contains non-finite value");
    }
  }
  return sql.raw(`'[${emb.map((n) => n.toString()).join(",")}]'::vector(1024)`);
}

type Embeddable = {
  front: ModuleFrontMatter;
  body: string;
  chunks: TextChunk[];
};

type ExistingRow = {
  id: string;
  chunkIndex: number;
  metadata: unknown;
  embedding: unknown;
};

/**
 * Produces an embedding for each chunk, reusing the DB when `metadata.content_hash` matches
 * the SHA-256 of `title + "\n" + chunk content`.
 */
export async function resolveEmbeddings(
  existingByIndex: Map<number, ExistingRow>,
  input: Embeddable,
  logSkip: (chunkIndex: number) => void,
): Promise<number[][]> {
  const out: number[][] = [];
  const { front, chunks } = input;
  for (const ch of chunks) {
    const hash = contentHashForChunk(front.title, ch.content);
    const ex = existingByIndex.get(ch.chunkIndex);
    const existingMeta = ex?.metadata;
    const prevHash =
      existingMeta && typeof existingMeta === "object" && existingMeta !== null && "content_hash" in existingMeta
        ? (existingMeta as { content_hash?: unknown }).content_hash
        : undefined;
    if (typeof prevHash === "string" && prevHash === hash && ex) {
      logSkip(ch.chunkIndex);
      out.push(embeddingArrayFromDbValue(ex.embedding));
    } else {
      const t = buildEmbeddingText(front.title, ch.content);
      out.push(await embedTitanV2(t));
    }
  }
  return out;
}

function embeddingArrayFromDbValue(embedding: unknown): number[] {
  if (Array.isArray(embedding)) {
    if (embedding.length === 1024) {
      return embedding.map((n) => Number(n)) as number[];
    }
  }
  if (typeof embedding === "string") {
    return parsePgVectorText(embedding);
  }
  throw new Error("Could not parse existing embedding from database");
}

/** Postgres may return `vector` as a string like `"{0.1,0.2,...}"` (pg default) or another wire format. */
function parsePgVectorText(s: string): number[] {
  const t = s.trim();
  if (t.startsWith("[") && t.endsWith("]")) {
    return t
      .slice(1, -1)
      .split(",")
      .map((x) => Number.parseFloat(x.trim()));
  }
  if (t.startsWith("{") && t.endsWith("}")) {
    return t
      .slice(1, -1)
      .split(",")
      .map((x) => Number.parseFloat(x.trim()));
  }
  throw new Error("Unexpected vector text format from Postgres");
}

export type UpsertOneResult = { moduleId: string; chunkCount: number };

/**
 * One transaction: upsert module, trim orphan chunks, upsert all chunk rows.
 */
export async function upsertModuleWithChunks(
  databaseUrl: string,
  input: Embeddable,
  embeddings: number[][],
): Promise<UpsertOneResult> {
  if (input.chunks.length !== embeddings.length) {
    throw new Error("chunks and embeddings length mismatch");
  }
  const db = createDbClient(databaseUrl);
  const { front, body, chunks } = input;
  return await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(modules)
      .values({
        slug: front.slug,
        title: front.title,
        category: front.category,
        stageRelevance: front.stage_relevance,
        tier: front.tier,
        summary: front.summary,
        bodyMd: body,
        attributionLine: front.attribution_line,
        expertReviewer: front.expert_reviewer,
        reviewDate: front.review_date,
        nextReviewDue: null,
        tryThisToday: front.try_this_today ?? null,
        published: true,
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
          published: sql`excluded."published"`,
        },
      })
      .returning({ id: modules.id });
    if (!row) {
      throw new Error("Upsert module returned no row");
    }
    const moduleId = row.id;
    await tx.delete(moduleTopics).where(eq(moduleTopics.moduleId, moduleId));
    if (front.topics.length > 0) {
      await tx.insert(moduleTopics).values(
        front.topics.map((topicSlug) => ({ moduleId, topicSlug })),
      );
    }
    if (chunks.length === 0) {
      await tx.delete(moduleChunks).where(eq(moduleChunks.moduleId, moduleId));
      return { moduleId, chunkCount: 0 };
    }
    await tx
      .delete(moduleChunks)
      .where(and(eq(moduleChunks.moduleId, moduleId), gte(moduleChunks.chunkIndex, chunks.length)));
    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i]!;
      const emb = embeddings[i]!;
      const hash = contentHashForChunk(front.title, ch.content);
      const metadata: ChunkMetadata = {
        section_heading: ch.sectionHeading,
        stage_relevance: front.stage_relevance,
        content_hash: hash,
      };
      await tx
        .insert(moduleChunks)
        .values({
          moduleId,
          chunkIndex: ch.chunkIndex,
          content: ch.content,
          tokenCount: ch.tokenCount,
          embedding: toVectorColumn(emb) as never,
          metadata,
        })
        .onConflictDoUpdate({
          target: [moduleChunks.moduleId, moduleChunks.chunkIndex],
          set: {
            content: sql`excluded."content"`,
            tokenCount: sql`excluded."token_count"`,
            embedding: sql`excluded."embedding"::vector(1024)`,
            metadata: sql`excluded."metadata"`,
          },
        });
    }
    return { moduleId, chunkCount: chunks.length };
  });
}

/**
 * Read existing module chunks for hash comparison and embedding reuse.
 */
export async function loadExistingChunkMap(
  databaseUrl: string,
  moduleSlug: string,
): Promise<{
  moduleId: string;
  byIndex: Map<number, ExistingRow>;
}> {
  const db = createDbClient(databaseUrl);
  const [m] = await db.select().from(modules).where(eq(modules.slug, moduleSlug)).limit(1);
  if (!m) {
    return { moduleId: "", byIndex: new Map() };
  }
  const rows = await db
    .select()
    .from(moduleChunks)
    .where(eq(moduleChunks.moduleId, m.id));
  const byIndex = new Map<number, ExistingRow>();
  for (const r of rows) {
    byIndex.set(r.chunkIndex, {
      id: r.id,
      chunkIndex: r.chunkIndex,
      metadata: r.metadata,
      embedding: r.embedding,
    });
  }
  return { moduleId: m.id, byIndex };
}
