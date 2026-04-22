# ADR 0006 — Content pipeline v0 (TASK-008)

## Status

Accepted (Sprint 1 vertical slice).

## Context

Hypercare’s answering path is **grounded, not generated** (PRD §8–§9). The RAG path needs rows in `modules` and `module_chunks` with real embeddings. TASK-008 delivers a **small, operator-run pipeline**: Markdown on disk, validated front matter, section-aware chunking, **Amazon Titan Text Embeddings v2** via **Amazon Bedrock** in **ca-central-1**, and idempotent upserts into PostgreSQL (pgvector).

## Decisions

### 1. Source of truth: files in the repo (v0)

Pilot content lives under `content/modules/*.md` with YAML front matter and a Markdown body. This favors reviewability, diffs, and PM/legal review over CMS or S3. Scaling to a larger library is a later concern.

### 2. Chunking: headings first, then length limits

- Split the body on top-level `##` headings. Each section title becomes `metadata.section_heading` for that chunk.
- If a section exceeds **~700 tokens** (approximated as **4 characters per token** for v0), split further on **paragraph** boundaries, then on **sliding character windows** with **60 tokens** of overlap between consecutive windows in token space.
- The **module title** is **prepended to the string sent to the embedding model** only (`title + "\n" + chunk content`). Stored `module_chunks.content` is the chunk body as shown for grounding; it does not duplicate the title.

Heuristics are tuned later (TASK-012) with evals.

### 3. Embedding model and region

- **Model:** `amazon.titan-embed-text-v2:0`
- **Parameters:** `dimensions: 1024`, `normalize: true` (matches `module_chunks.embedding` as `vector(1024)` per ADR 0002)
- **Region:** `ca-central-1` for Bedrock and the database, consistent with the rest of the stack.
- **Credentials:** Default AWS provider chain (e.g. `aws sso login`, env vars, instance role). The loader does **not** read long-lived access keys from Secrets Manager; operators authenticate as for other AWS CLIs.

### 4. Idempotency and cost control

- **Module row:** `INSERT ... ON CONFLICT (slug) DO UPDATE` with `SET` listing updatable fields only. **`created_at` is not updated**, so a second run does not look like a new module.
- **Chunk rows:** `ON CONFLICT (module_id, chunk_index) DO UPDATE` for the natural key `(module_id, chunk_index)`.
- **Embedding skip:** `metadata.content_hash` holds **SHA-256** of `title + "\n" + chunk content`. If the existing row’s hash matches, **no Bedrock call** is made for that chunk; the new vector is re-derived from the stored embedding only insofar as the upsert rewrites the row (content unchanged). Logs include `skip <slug> chunk <n> (hash match)`.

This keeps CI and second runs cheap and stable.

### 5. Database connection: operator admin URL

The loader is **not** the web app. It uses `DATABASE_URL_ADMIN` (see `docs/infra-runbook.md`), typically the Aurora admin user over the SSM tunnel, so `published = true` and migrations-style operations are unambiguous. Runtime app traffic continues to use the least-privilege `hypercare_app` role (separate from this ADR).

## Consequences

- Adding a new embedding model width requires a **schema migration** (ADR 0002).
- Chunk quality and size settings will change when retrieval evals exist; the SHA-based skip remains valid as long as the hash is defined the same way.

## References

- ADR 0002 — Drizzle schema v0
- `tasks/TASK-008-content-loader.md`
- [Amazon Titan Text Embeddings — Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html)
