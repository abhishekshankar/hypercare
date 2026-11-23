import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { modules } from "./modules.js";

/**
 * Chunk embeddings use `vector(1024)` to match Amazon Titan Text Embeddings v2
 * (`amazon.titan-embed-text-v2:0`) default output size per AWS Bedrock docs.
 */
export const moduleChunks = pgTable(
  "module_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("module_chunks_module_id_chunk_index_unique").on(t.moduleId, t.chunkIndex),
    index("module_chunks_module_id_idx").on(t.moduleId),
    index("module_chunks_metadata_gin").using("gin", t.metadata),
    index("module_chunks_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")).with({
      m: 16,
      ef_construction: 64,
    }),
  ],
);
