-- SURFACES-06: embed heavy-module branch bodies for branch-aware RAG retrieval.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS module_branch_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES module_branches(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  token_count integer NOT NULL,
  embedding vector(1024) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT module_branch_chunks_module_branch_chunk_unique UNIQUE (module_id, branch_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS module_branch_chunks_module_id_idx ON module_branch_chunks (module_id);
CREATE INDEX IF NOT EXISTS module_branch_chunks_branch_id_idx ON module_branch_chunks (branch_id);
CREATE INDEX IF NOT EXISTS module_branch_chunks_metadata_gin ON module_branch_chunks USING gin (metadata);

CREATE INDEX IF NOT EXISTS module_branch_chunks_embedding_hnsw
  ON module_branch_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
