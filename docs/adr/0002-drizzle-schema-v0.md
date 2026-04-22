# ADR 0002 — Drizzle schema v0 (TASK-004)

## Status

Accepted (Sprint 1 vertical slice).

## Context

Hypercare needs a single v0 relational model shared by onboarding, RAG, safety, and conversation features. The cluster from TASK-003 provides PostgreSQL with `pgvector`; this ADR locks the first migration and Drizzle models so later tickets add **additive** migrations only.

## Decisions

### 1. `updated_at` maintenance: database trigger

We use one trigger function `hypercare_set_updated_at()` and `BEFORE UPDATE` triggers on `users`, `care_profile`, `conversations`, and `modules`. Application code does not need to remember to bump `updated_at`, avoiding drift across handlers.

`messages`, `module_chunks`, and `safety_flags` are insert-mostly in v0 and only expose `created_at` (or no `updated_at` column).

### 2. Vector index: HNSW + cosine

We index `module_chunks.embedding` with **HNSW** and **cosine** distance (`vector_cosine_ops`). Compared to IVFFlat, HNSW avoids a training/`lists` tuning step and fits early-scale retrieval; we can revisit if dataset size or recall/latency targets change.

Exact migration statement:

```sql
CREATE INDEX "module_chunks_embedding_hnsw" ON "module_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m=16, ef_construction=64);
```

### 3. Embedding width: 1024 dimensions

`module_chunks.embedding` is `vector(1024)` to match **Amazon Titan Text Embeddings v2** (`amazon.titan-embed-text-v2:0`). AWS documents that this model outputs **1,024 dimensions by default** (with optional 512 / 256 variants). We pin the **default 1,024** output so the column width matches the Bedrock default without extra inference parameters.

Source: [Amazon Titan Text Embeddings models — Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html).

### 4. CHECK constraints instead of Postgres enums

Domain values (e.g. care profile relationship, module category) use `text` columns plus `CHECK` constraints. Native enums are avoided because altering enum labels in PostgreSQL is operationally painful; additive CHECK migrations are simpler for staged rollouts.

### 5. One `care_profile` row per user (no history in v0)

The PRD’s “situation changed over time” narrative is **out of scope** for v0. `care_profile.user_id` is `UNIQUE`; a future migration can introduce history tables without breaking this baseline.

### 6. Migration runner: programmatic `migrate()` with `postgres-js`

We apply SQL migrations with `tsx src/migrate.ts`, which validates `DATABASE_URL` through Zod (`requireDatabaseUrl`) before opening a connection, then runs Drizzle’s `migrate()` against `packages/db/migrations`. This keeps secrets out of the config file and fails fast on misconfiguration.

`drizzle-kit generate` / `studio` still use `drizzle.config.ts`; `generate` allows a placeholder URL when `DATABASE_URL` is unset so CI can generate artifacts without a live database.

## Consequences

- Changing the embedding model to a non-1024 default requires a **new migration** (column alter or parallel column + backfill).
- Aurora PostgreSQL must support `EXECUTE FUNCTION` on triggers (PostgreSQL 14+ style). If an older engine required `EXECUTE PROCEDURE` instead, adjust the migration in a follow-up patch.
