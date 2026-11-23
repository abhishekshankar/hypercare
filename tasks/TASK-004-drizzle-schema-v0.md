# TASK-004 — Drizzle schema v0: users, care_profile, conversations, messages, modules, module_chunks, safety_flags

**Owner:** Cursor
**Depends on:** TASK-003
**Status:** done

## Why this exists

TASK-003 brought up the cluster and the two databases (`hypercare_dev`, `hypercare_prod`) with the `vector` extension enabled, but there are no tables. Every ticket after this one — onboarding writes (TASK-007), module ingestion and pgvector storage (TASK-008), the RAG pipeline (TASK-009), the safety escalation flow (TASK-010), and the conversation UI (TASK-011) — assumes these seven tables exist, with stable columns and foreign keys. This ticket is the one place we commit to the v0 shape. Later tickets write additive migrations; they do not re-litigate this schema.

The schema is **v0**, not final. Sprint 1 only needs enough columns to prove the vertical slice works. Do not over-engineer for sprint 2 screens. Anything not needed by TASK-005 through TASK-012 is out of scope, even if the PRD hints at it.

## Context to read before starting

- `PROJECT_BRIEF.md §2` (stack — Drizzle ORM, SQL migrations, `drizzle-kit`), `§5` ("Never edit a shipped migration — write a new one"), `§8` (never fetch or print secret values).
- `prd.md §5` — the care profile is the spine of the product; the shape is prescribed there, not invented here.
- `prd.md §6.4` — the response scaffold the conversation screen renders. Messages need to carry the pieces of that scaffold.
- `prd.md §7.2` — module shape (expert source, caregiver quote, "try this," related link, evidence table, review metadata).
- `prd.md §7.3` and `§9.2 Layer 1` — source tiers (1, 2, 3). Retrieval strongly prefers Tier 1.
- `prd.md §9.2 Layer 3` — hybrid retrieval with metadata filters; chunks carry stage/topic.
- `prd.md §9.4` — embeddings model is Titan Text Embeddings v2 to start. Its output dimension determines the `vector(N)` column width. **Confirm the dimension from Bedrock docs and write it down in the ADR.**
- `prd.md §10.1` — the six risk categories. `safety_flags` records which one(s) fired on a given query.
- `docs/infra-runbook.md` — how to tunnel to the dev cluster and run SQL. Use this to apply the migration during verification.
- `docs/auth-contract.md` — the Cognito `sub` claim is the immutable user key. The `users` table keys on that.

## What "done" looks like

A migration that, when applied to a fresh `hypercare_dev` and `hypercare_prod`, produces seven tables with the columns, types, constraints, and indexes specified below; a Drizzle schema in `packages/db/src/schema/` that exactly mirrors those tables; a `drizzle.config.ts` and working `pnpm --filter @alongside/db migrate` script; and a least-privilege app role that the application will use at runtime (not the admin user).

## Acceptance criteria

### Drizzle setup

- [ ] `packages/db` adds `drizzle-orm`, `drizzle-kit`, `postgres` (postgres-js), and `zod` as dependencies. No `pg` and no `node-postgres`; the project standardizes on `postgres-js` with Drizzle.
- [ ] `packages/db/drizzle.config.ts` configured for PostgreSQL, `schema: ./src/schema/*.ts`, `out: ./migrations`, `dialect: "postgresql"`, reading the connection string from `DATABASE_URL` validated with `zod` at boot.
- [ ] `packages/db/src/schema/` contains one file per table (`users.ts`, `care-profile.ts`, `conversations.ts`, `messages.ts`, `modules.ts`, `module-chunks.ts`, `safety-flags.ts`) plus an `index.ts` that re-exports them.
- [ ] `packages/db/src/client.ts` exports a typed Drizzle client factory (takes a `DATABASE_URL`, returns `drizzle(...)`). Not a singleton — the app will call the factory inside request scope in a later ticket.
- [ ] `packages/db/src/env.ts` validates `DATABASE_URL` with `zod` and exits the process with a clear error on missing/malformed values.
- [ ] Scripts in `packages/db/package.json`: `generate` (`drizzle-kit generate`), `migrate` (`drizzle-kit migrate` or a small runner script under `src/migrate.ts` — pick one and document in the PR), `studio` (`drizzle-kit studio`).
- [ ] `pnpm --filter @alongside/db typecheck`, `lint`, and `build` pass with zero warnings.

### Migration

- [ ] Exactly **one** SQL migration in `packages/db/migrations/` for this ticket (`0000_init.sql` or similar — `drizzle-kit`'s default numbering is fine). Do not hand-edit after generation unless necessary for pgvector (see below).
- [ ] The migration enables `pgvector` idempotently (`CREATE EXTENSION IF NOT EXISTS vector`) at the top. The cluster already has `vector` enabled per TASK-003, but the migration must be safe to run against a fresh database too. `drizzle-kit` will not generate this — hand-add it at the top of the generated SQL and note it in the PR description.
- [ ] Migration runs cleanly against both `hypercare_dev` and `hypercare_prod` via the SSM tunnel described in `docs/infra-runbook.md`. Capture the output in the PR.
- [ ] Re-running the migration on an already-migrated database is a no-op (Drizzle's `__drizzle_migrations` table handles this — verify).

### Table: `users`

One row per Hypercare user. Keyed on Cognito `sub`. No password material, ever.

- [ ] `id uuid primary key default gen_random_uuid()` (enable `pgcrypto` if not already — add to the migration).
- [ ] `cognito_sub text not null unique` — the `sub` claim from the Cognito ID token. Immutable.
- [ ] `email text not null` — denormalized from Cognito for display. Not unique (Cognito owns uniqueness).
- [ ] `display_name text` — nullable; the caregiver's first name, populated during onboarding.
- [ ] `created_at timestamptz not null default now()`.
- [ ] `updated_at timestamptz not null default now()` — updated by a trigger (see "Triggers" below) or by application code. **Pick one and document in the PR.** Prefer a trigger — one place, no drift.
- [ ] Index on `cognito_sub` (unique constraint above gives this for free; confirm).

### Table: `care_profile`

One row per user. Enforced by a unique constraint on `user_id`. Mirrors `prd.md §5`.

- [ ] `id uuid primary key default gen_random_uuid()`.
- [ ] `user_id uuid not null unique references users(id) on delete cascade`.
- [ ] Section 1 (the care recipient):
  - [ ] `cr_first_name text not null`.
  - [ ] `cr_age integer` — nullable; caregivers sometimes don't know exactly.
  - [ ] `cr_relationship text not null` — one of `parent | spouse | sibling | in_law | other`. Enforce with a CHECK constraint, not a Postgres enum (enums are painful to migrate).
  - [ ] `cr_diagnosis text` — one of `alzheimers | vascular | lewy_body | frontotemporal | mixed | unknown_type | suspected_undiagnosed`. CHECK constraint. Nullable.
  - [ ] `cr_diagnosis_year integer` — nullable.
- [ ] Section 2 (stage assessment — stored as the raw answers plus the inferred stage):
  - [ ] `stage_answers jsonb not null default '{}'::jsonb` — keyed by the question IDs defined in TASK-007. Do not freeze a column-per-question here; TASK-007 owns the question set.
  - [ ] `inferred_stage text` — one of `early | middle | late | unknown`. CHECK constraint. Nullable (unknown until onboarding completes).
- [ ] Section 3 (living/care situation):
  - [ ] `living_situation text` — CHECK over `with_caregiver | alone | with_other_family | assisted_living | memory_care | nursing_home`. Nullable.
  - [ ] `care_network text` — CHECK over `solo | siblings_helping | paid_help | spouse_of_cr`. Nullable.
  - [ ] `care_hours_per_week integer` — nullable.
  - [ ] `caregiver_proximity text` — CHECK over `same_home | same_city | remote`. Nullable.
- [ ] Section 4 (the caregiver):
  - [ ] `caregiver_age_bracket text` — CHECK over `under_40 | 40_54 | 55_64 | 65_74 | 75_plus`. Nullable.
  - [ ] `caregiver_work_status text` — CHECK over `working | retired | other`. Nullable.
  - [ ] `caregiver_state_1_5 integer` — 1 to 5, CHECK constraint, nullable.
  - [ ] `hardest_thing text` — free text, nullable.
- [ ] Section 5 ("what matters to CR"):
  - [ ] `cr_background text` — nullable.
  - [ ] `cr_joy text` — nullable.
  - [ ] `cr_personality_notes text` — nullable.
- [ ] Timestamps: `created_at`, `updated_at` as above.
- [ ] Trigger or app-enforced `updated_at` maintenance. Same decision as `users`.

Out of scope: evolution history ("My situation has changed" diffs over time — PRD §5.6). Sprint 2.

### Table: `conversations`

One row per conversation thread. A thread is a sequence of messages under one topic, started when the user submits a query from the home screen.

- [ ] `id uuid primary key default gen_random_uuid()`.
- [ ] `user_id uuid not null references users(id) on delete cascade`.
- [ ] `title text` — short human label, nullable (generated after the first exchange by TASK-011 or left null in sprint 1).
- [ ] `created_at timestamptz not null default now()`.
- [ ] `updated_at timestamptz not null default now()`.
- [ ] Index on `(user_id, updated_at desc)` — the home screen lists recent conversations.

### Table: `messages`

One row per turn (user and assistant each get a row). Carries enough structure for the PRD §6.4 response scaffold and for Layer 7 attribution.

- [ ] `id uuid primary key default gen_random_uuid()`.
- [ ] `conversation_id uuid not null references conversations(id) on delete cascade`.
- [ ] `role text not null` — CHECK over `user | assistant | system`. (System rows are for refusal messages and canned safety scripts, so they're distinguishable from LLM-generated assistant turns.)
- [ ] `content text not null` — the rendered message body.
- [ ] `response_kind text` — CHECK over `answer | refusal | safety_script`, nullable. Only set on assistant/system rows.
- [ ] `retrieval jsonb` — nullable. On assistant rows with `response_kind='answer'`, this holds `{ "chunks": [ { "chunk_id": "...", "module_id": "...", "score": 0.87 } ] }`. Sprint 1 stores it; sprint 2 may index into it.
- [ ] `classifier jsonb` — nullable. The Layer 2 query classification output: `{ "topic": "...", "urgency": "...", "stage_relevance": "...", "safety_flags": [...] }`.
- [ ] `verification jsonb` — nullable. The Layer 6 post-generation verifier output: `{ "passed": true, "issues": [] }`.
- [ ] `model_id text` — nullable. E.g., `anthropic.claude-3-5-sonnet-20241022-v2:0`. So we can tell which model produced which answer in the eval harness.
- [ ] `created_at timestamptz not null default now()`.
- [ ] Index on `(conversation_id, created_at asc)` — message rendering order.

Out of scope: "Was this helpful?" thumbs, "Save this" bookmarks. Those get their own tables in sprint 2; they do not belong on `messages`.

### Table: `modules`

One row per reviewed content module. Mirrors `prd.md §7.2` but only the fields the RAG pipeline and the attribution line actually need in sprint 1.

- [ ] `id uuid primary key default gen_random_uuid()`.
- [ ] `slug text not null unique` — stable identifier used in attribution and in the seed loader (TASK-008).
- [ ] `title text not null`.
- [ ] `category text not null` — CHECK over `behaviors | daily_care | communication | medical | legal_financial | transitions | caring_for_yourself` (the seven from PRD §7.1).
- [ ] `stage_relevance text[] not null default '{}'` — subset of `early | middle | late | any`. Used as a metadata filter in Layer 3 retrieval.
- [ ] `tier integer not null` — CHECK over `1, 2, 3`. The source tier from PRD §7.3. Retrieval prefers `1`.
- [ ] `summary text not null` — one-paragraph summary suitable for prompt composition when the full module isn't retrieved.
- [ ] `body_md text not null` — the full module body in Markdown. Sprint 1 doesn't render this in the UI; retrieval uses chunks. It's stored so content ops and the eval harness have the source of truth in the DB.
- [ ] `attribution_line text not null` — the canonical sentence rendered at the bottom of an answer per PRD §6.4 ("Based on guidance from the Alzheimer's Association…"). Pre-composed so the UI doesn't have to assemble it.
- [ ] `expert_reviewer text` — nullable in sprint 1 (pilot modules are PM-authored).
- [ ] `review_date date` — nullable in sprint 1.
- [ ] `next_review_due date` — nullable in sprint 1.
- [ ] `published boolean not null default false` — the RAG pipeline only retrieves `published = true`.
- [ ] `created_at`, `updated_at` timestamps.
- [ ] Index on `(category, tier, published)` — retrieval pre-filters on these before vector similarity.

Out of scope: caregiver quote, "try this" action, related-module links, evidence table. PRD §7.2 lists them; sprint 2 will model them. The v1 module body is sufficient for the vertical slice.

### Table: `module_chunks`

One row per chunk produced by the content loader. Retrieved by Layer 3.

- [ ] `id uuid primary key default gen_random_uuid()`.
- [ ] `module_id uuid not null references modules(id) on delete cascade`.
- [ ] `chunk_index integer not null` — ordering within the module.
- [ ] `content text not null` — the chunk text.
- [ ] `token_count integer not null` — at write time. Used by prompt composition (Layer 5) to budget context.
- [ ] `embedding vector(N) not null` — where `N` is the Titan Text Embeddings v2 output dimension. **Confirm from Bedrock docs and pin it in the ADR and in a comment on the column.** Do not guess.
- [ ] `metadata jsonb not null default '{}'::jsonb` — keeps `{ "stage_relevance": [...], "category": "...", "tier": N }` duplicated from the parent module so the retrieval query can filter without a join when needed.
- [ ] `created_at timestamptz not null default now()`.
- [ ] Unique constraint on `(module_id, chunk_index)`.
- [ ] Index: an **IVFFlat** or **HNSW** vector index on `embedding`. **Pick one and document the decision in the ADR.** Default recommendation: HNSW with `vector_cosine_ops` (higher recall at small scale, no training step needed). Include the exact `CREATE INDEX` statement in the migration.
- [ ] B-tree indexes on `module_id` and a GIN index on `metadata`.

### Table: `safety_flags`

One row per flag fired by the Layer 2 classifier or the safety classifier (PRD §10). Written by TASK-010's flow. Exists in v0 so TASK-009 and TASK-010 don't have to add it themselves.

- [ ] `id uuid primary key default gen_random_uuid()`.
- [ ] `message_id uuid not null references messages(id) on delete cascade` — the user message that triggered the flag.
- [ ] `conversation_id uuid not null references conversations(id) on delete cascade` — denormalized for faster weekly-review queries.
- [ ] `user_id uuid not null references users(id) on delete cascade` — same rationale.
- [ ] `category text not null` — CHECK over the six PRD §10.1 categories: `caregiver_self_harm | cr_in_danger | elder_abuse | dangerous_request | medical_emergency | financial_exploitation`.
- [ ] `severity text not null` — CHECK over `low | medium | high | emergency`.
- [ ] `confidence numeric(3,2) not null` — 0.00 to 1.00. CHECK constraint.
- [ ] `classifier_output jsonb not null` — the raw classifier response (model id, prompt version, structured fields). Audit trail; the review cadence in PRD §10.2 depends on this.
- [ ] `escalation_rendered text` — the canonical script name used (e.g., `caregiver_self_harm_v1`), nullable if no script was rendered.
- [ ] `created_at timestamptz not null default now()`.
- [ ] Indexes on `(user_id, created_at desc)` and `(category, created_at desc)`.

### Triggers / helpers

- [ ] A single `updated_at` trigger function (`moddatetime`-style or hand-written) applied to `users`, `care_profile`, `conversations`, `modules`. Put it in the migration above the table DDL.
- [ ] `CREATE EXTENSION IF NOT EXISTS pgcrypto;` at the top of the migration (for `gen_random_uuid()`). `CREATE EXTENSION IF NOT EXISTS vector;` also at the top.

### Least-privilege application role

The app must not connect as `hypercare_admin`. Provision a role the app will use at runtime. Per `PROJECT_BRIEF.md §8`, **do not create the password yourself or print anything from Secrets Manager.** Instead:

- [ ] Add a separate SQL file `packages/db/scripts/bootstrap-app-role.sql` (not a Drizzle migration — this is a one-time operator action) that:
  - Creates a role `hypercare_app` with `LOGIN`.
  - Grants `CONNECT` on `hypercare_dev` and `hypercare_prod`.
  - Grants `USAGE` on schema `public`.
  - Grants `SELECT, INSERT, UPDATE, DELETE` on all tables in `public` and sets default privileges so new tables inherit the grants.
  - Does **not** grant `DROP`, `TRUNCATE`, or membership in `rds_superuser`.
- [ ] Document in `docs/infra-runbook.md` the exact operator steps: PM connects as `hypercare_admin` via the SSM tunnel, runs `CREATE ROLE hypercare_app LOGIN PASSWORD <PM-provided>;`, runs the grants file, stores the password in Secrets Manager under a new secret (separate from the admin secret), and records the ARN in `.env.example` as a comment.
- [ ] `.env.example` gains `DATABASE_URL=` with a comment pointing at the runbook. No real values.

### Typecheck, lint, tests

- [ ] `pnpm lint && pnpm typecheck && pnpm -r build && pnpm test` pass at the repo root.
- [ ] At least one Vitest test in `packages/db/test/` that imports the schema and asserts the inferred Drizzle types compile (a type-level test is sufficient; no live DB required).

### Docs

- [ ] `docs/adr/0002-drizzle-schema-v0.md` — records the decisions Cursor had to make: updated_at via trigger vs app code; HNSW vs IVFFlat; vector dimension (with the Bedrock doc link that pins it); why enums-as-CHECK-constraints over Postgres enums; why one row per care_profile (not a versioned history yet).
- [ ] `docs/schema-v0.md` — a one-page ERD or ASCII diagram + a brief note per table explaining which ticket writes to it and which reads from it. Keeps the mental model accessible.

## Files you will likely create / touch

```
packages/db/
  drizzle.config.ts
  package.json                  (deps + scripts)
  src/
    env.ts
    client.ts
    index.ts                    (re-exports)
    schema/
      users.ts
      care-profile.ts
      conversations.ts
      messages.ts
      modules.ts
      module-chunks.ts
      safety-flags.ts
      index.ts
    migrate.ts                  (if you pick a runner script over drizzle-kit migrate)
  migrations/
    0000_init.sql               (generated, with pgvector/pgcrypto extension lines hand-added at the top, plus the HNSW index statement)
    meta/...                    (drizzle-kit metadata)
  scripts/
    bootstrap-app-role.sql
  test/
    schema.types.test.ts
docs/
  adr/0002-drizzle-schema-v0.md
  schema-v0.md
  infra-runbook.md              (append app-role bootstrap steps)
.env.example                    (add DATABASE_URL comment)
```

## Out of scope — do not do these here

- Seeding any data into `modules` or `module_chunks`. That's TASK-008.
- Any API, Route Handler, or server component that reads these tables. Tickets 006–011.
- Evolution-over-time modeling of the care profile (PRD §5.6). Sprint 2.
- Sprint-2 tables: bookmarks ("Save this"), feedback ("thumbs"), daily-lesson completions, library-browsing state, caregiver check-ins. None of these belong in v0.
- Row-Level Security policies. We'll add them once multi-tenant concerns sharpen in sprint 2; sprint 1 enforces access in the API layer.
- Any change to CDK or to the Aurora cluster itself. The cluster is as TASK-003 left it.
- Reading or printing the admin secret, the new app-role secret, or any other secret value. `aws secretsmanager describe-secret` only, per `PROJECT_BRIEF.md §8`.

## How the PM will verify

1. `pnpm install` at the repo root — clean.
2. `pnpm --filter @alongside/db typecheck && pnpm --filter @alongside/db lint && pnpm --filter @alongside/db build` — all green.
3. `pnpm test` — green.
4. Open the SSM tunnel (`./scripts/db-tunnel.sh`). In a second terminal, as `hypercare_admin` against `hypercare_dev`:
   - `DATABASE_URL=... pnpm --filter @alongside/db migrate`
   - `psql ... -c '\dt'` — lists the seven tables plus `__drizzle_migrations`.
   - `psql ... -c '\dx'` — shows `vector` and `pgcrypto`.
   - `psql ... -c '\d module_chunks'` — shows the `embedding vector(N)` column and the HNSW (or IVFFlat) index.
5. Re-run `pnpm --filter @alongside/db migrate` — reports no changes.
6. Repeat step 4 (migrate only) against `hypercare_prod`.
7. Connect as `hypercare_admin`, run `packages/db/scripts/bootstrap-app-role.sql` with a PM-supplied password, then verify as `hypercare_app` that a `SELECT` on `users` succeeds and a `DROP TABLE users` fails with a permission error.
8. Read the two new docs (`ADR 0002`, `schema-v0.md`) — each decision listed above has a paragraph.

## Decisions Cursor will make and report

- **`updated_at` maintenance:** trigger vs. application-side. PM preference is trigger.
- **Vector index:** HNSW vs. IVFFlat, and the exact opclass (recommend `vector_cosine_ops`). Include the `ef_construction` / `m` parameters (HNSW) or `lists` (IVFFlat) actually used.
- **Migration runner:** `drizzle-kit migrate` vs. a small in-repo runner in `src/migrate.ts` that loads and applies the SQL files. Either is fine; pick and explain.
- **Embedding dimension:** the exact integer for Titan Text Embeddings v2, with the Bedrock doc URL that confirms it. Do not guess. If the docs ambiguously describe multiple variants, pick one (and name it in the ADR) rather than parameterizing — a later migration can widen or narrow if we change models.

## Questions Cursor is likely to have

- "Should `care_profile` allow multiple rows per user so we can keep a history?" — No, not in v0. One row per user. The "My situation has changed" diff log is sprint 2.
- "Should I model the Section 7.2 extras (caregiver quote, try-this, related links) now?" — No. Those arrive with the authoring tool in sprint 3. Sprint 1 seed modules are self-contained Markdown.
- "Should I add RLS?" — No (see Out of scope).

## Report-back template

Use the format in `PROJECT_BRIEF.md §7`. Include in the report:

- The exact vector dimension used and the Bedrock doc link.
- The exact `CREATE INDEX` statement used for the vector index, with its parameters.
- The output of `psql -c '\dt'` after the migration.
- Whether the migration applied cleanly to `hypercare_prod` as well as `hypercare_dev`.
- Confirmation that `hypercare_app` was provisioned, and by whom (PM, as an operator step — Cursor wrote the SQL, PM ran it).
