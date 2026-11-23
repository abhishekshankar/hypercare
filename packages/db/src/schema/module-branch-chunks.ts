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
import { moduleBranches } from "./module-branches.js";
import { modules } from "./modules.js";

export const moduleBranchChunks = pgTable(
  "module_branch_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => moduleBranches.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("module_branch_chunks_module_branch_chunk_unique").on(t.moduleId, t.branchId, t.chunkIndex),
    index("module_branch_chunks_module_id_idx").on(t.moduleId),
    index("module_branch_chunks_branch_id_idx").on(t.branchId),
    index("module_branch_chunks_metadata_gin").using("gin", t.metadata),
    index("module_branch_chunks_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")).with({
      m: 16,
      ef_construction: 64,
    }),
  ],
);
