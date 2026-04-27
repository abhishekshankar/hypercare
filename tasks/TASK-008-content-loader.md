# TASK-008 — Content loader: seed 3 pilot modules, chunk, embed, store in pgvector

- **Owner:** Cursor
- **Depends on:** TASK-003 (infra), TASK-004 (schema), TASK-007 (not strictly — but do not run against a prod DB that has real user data)
- **Status:** done
- **ADR:** `docs/adr/0006-content-pipeline-v0.md` (new, written as part of this task)

---

## Why this exists

Hypercare's answering path is **grounded, not generated** (PRD §8, §9). Before we can build the RAG pipeline (TASK-009) or the home/conversation UI (TASK-011), the `modules` and `module_chunks` tables need real rows with real embeddings. Without seeded content, there is nothing to retrieve, nothing to ground against, and nothing to measure the pipeline on in TASK-012.

This task stands up the **content pipeline v0**: author a small, hand-picked set of pilot modules as Markdown files with front-matter, ship a loader that parses them, chunks each body, calls Amazon Titan Text Embeddings v2 via Bedrock, and upserts the rows. It is deliberately small (3 modules) so we can iterate on chunk size, front-matter shape, and attribution rules before scaling to the full tier-1 library.

This is **not** the retrieval pipeline. This is only: source → rows in Postgres with embeddings attached.

---

## Context to read first

Read in this order:

1. `PROJECT_BRIEF.md` §7 (reporting format), §8 (secrets rule — Bedrock is called via default AWS credential chain; never print or commit keys).
2. `prd.md` §7 (module anatomy — **especially §7.2 the 8 required fields**, §7.4 tier strategy), §8 (grounded over generated), §9 (RAG pipeline — this task feeds layer 2 "retrieval").
3. `packages/db/src/schema/modules.ts` and `packages/db/src/schema/module-chunks.ts` — the target tables. The `modules.category` CHECK constraint allows exactly these 7 values: `behaviors`, `daily_care`, `communication`, `medical`, `legal_financial`, `transitions`, `caring_for_yourself`. `modules.tier` is 1/2/3. `module_chunks.embedding` is `vector(1024)` — Titan Text Embeddings v2 default.
4. `docs/infra-runbook.md` — region is `ca-central-1`; admin DB creds live in Secrets Manager; SSM tunnel via `./scripts/db-tunnel.sh`.
5. `docs/auth-contract.md` — not directly relevant, but confirms we are `ca-central-1`-native so Bedrock calls should also use `ca-central-1` unless a region is **explicitly** required otherwise (see "Decisions" below).
6. `tasks/TASK-004-drizzle-schema-v0.md` — reminder that the app role is `hypercare_app`, not admin. The loader is operator-run and MAY use admin creds (it runs offline, not from web app).

---

## What "done" looks like

1. A `content/modules/` directory exists at repo root with **exactly 3 Markdown files**, each with the front-matter shape defined in "Module file format" below. These are the **pilot** modules — one behavior, one daily-care, one self-care — small enough to review by hand.
2. A new package `packages/content/` exists with:
   - A loader that reads every `*.md` file under `content/modules/`.
   - A parser that validates front-matter against a `zod` schema.
   - A chunker that splits the Markdown body into overlapping text chunks.
   - An embedder that calls Bedrock `amazon.titan-embed-text-v2:0` and returns `number[]` of length 1024.
   - An upserter that writes `modules` and `module_chunks` rows idempotently.
3. A CLI entry point at `packages/content/src/cli.ts` runs end-to-end: parse → chunk → embed → upsert. Invocable from repo root as:
   ```bash
   pnpm --filter @alongside/content load
   ```
4. Running the CLI a **second time** does not duplicate rows and does not re-embed chunks whose source text is unchanged (see "Idempotency" below).
5. The three pilot modules end up in Postgres with `published = true`, with chunk counts that are non-zero and sensible (roughly 3–8 chunks per module for v0 content).
6. A short ADR `docs/adr/0006-content-pipeline-v0.md` captures: chunking strategy, embedding model + region, why files-in-repo for v0, idempotency key.
7. No Bedrock keys, DB URLs, or secret values are printed to logs or committed to the repo.

---

## Module file format (hand-author these three)

Each file lives at `content/modules/<slug>.md`. Front-matter is YAML between `---` fences; body is Markdown below.

Front-matter fields (all required except `expert_reviewer` and `review_date` — see Decisions):

```yaml
---
slug: behavior-sundowning              # matches filename, kebab-case, unique
title: "Sundowning: afternoon and evening agitation"
category: behaviors                    # one of the 7 CHECK values above
tier: 1                                 # 1 | 2 | 3 — all three pilots are tier 1
stage_relevance: ["early", "middle"]    # subset of early / middle / late
summary: "Short 1–2 sentence plain-language summary a caregiver sees in a retrieval hit."
attribution_line: "Adapted from the Alzheimer's Association caregiver guide, 2024."
expert_reviewer: null                   # null allowed in v0; fill in before tier-1 launch
review_date: null                       # ISO date or null in v0
---
```

Body is Markdown. Use `##` section headings. Aim for **400–900 words** per pilot module — long enough to chunk meaningfully, short enough that the PM can read all three in one sitting. Plain language, second-person ("you"), no medical advice tone. No emoji.

**Authorship note for the PM (not for Cursor):** the PM will hand Cursor the raw body text for each module. If the PM hasn't done that yet, Cursor should stub the three files with clearly-marked `TODO(PM)` body content so the pipeline can be exercised end-to-end, and flag this in the report-back.

### The three pilot slugs

| Slug | Category | Tier | Stage | Why this one |
|------|----------|------|-------|--------------|
| `behavior-sundowning` | `behaviors` | 1 | `["early", "middle"]` | Common, concrete, high-utility; good test of retrieval on behavioral queries. |
| `daily-bathing-resistance` | `daily_care` | 1 | `["middle", "late"]` | Represents the daily-care category; grounds the "manages_meds / bathes_alone" path from onboarding. |
| `self-care-caregiver-burnout` | `caring_for_yourself` | 1 | `["early", "middle", "late"]` | Covers the caregiver-facing half of the product — ensures retrieval has something to return when the user asks about themselves, not the care recipient. |

---

## Chunking strategy (v0)

- Split the body by `##` headings first; each top-level section becomes a candidate chunk.
- If any section exceeds **700 tokens** (approximate, use `@anthropic-ai/tokenizer` or a simple `~4 chars per token` heuristic), split it further on paragraph boundaries with **60-token overlap** between consecutive chunks.
- Strip front-matter before chunking. **Do** prepend the module title as a single line to the text that gets embedded (but store only the body chunk content in `module_chunks.content` — the title-prepending is for embedding quality only).
- Each chunk stores:
  - `chunk_index` — 0-based, contiguous within a module.
  - `content` — the raw chunk text as it will be shown / grounded against.
  - `token_count` — integer, approximate is fine.
  - `metadata` jsonb — at minimum `{ "section_heading": "<the ## heading the chunk falls under>", "stage_relevance": [...] }`. The stage array is duplicated from the parent module for retrieval filtering later.

Heuristics not hard rules: we will tune these in TASK-012 once we have evals. Do not spend time optimizing.

---

## Embedding call

- Model: `amazon.titan-embed-text-v2:0`
- Region: `ca-central-1`
- Input: `{ inputText: <chunk text with title prepended>, dimensions: 1024, normalize: true }`
- Output: `number[]` of length exactly 1024. Assert this length before insert; fail loudly if not.
- Credentials: default AWS provider chain (`fromNodeProviderChain()`). Operator running the loader has `aws sso login` or env vars already set. **Do not read a long-lived access key from Secrets Manager for this.**
- Rate-limit: Bedrock has per-account TPS limits. With 3 modules × ~5 chunks = ~15 calls, no batching / backoff is needed for v0. Sequential `for` loop is fine. Do not parallelize.

---

## Idempotency

Running `pnpm --filter @alongside/content load` a second time must not:

1. Create duplicate `modules` rows — use `INSERT ... ON CONFLICT (slug) DO UPDATE`.
2. Create duplicate `module_chunks` rows — `(module_id, chunk_index)` already has a unique constraint; use `ON CONFLICT DO UPDATE`.
3. Re-embed unchanged content. Compute a SHA-256 of `(title + "\n" + chunk_content)` and store it in `module_chunks.metadata.content_hash`. Before calling Bedrock, look up the existing chunk at `(module_id, chunk_index)`; if `metadata.content_hash` matches, skip the embedding call and keep the existing embedding.

The goal: running the loader on CI / in a fresh checkout re-syncs state without cost or flakiness.

---

## DB write path

- The loader is an **operator tool**, not the web app. It runs offline from an engineer's laptop (or later from CI). It is acceptable for v0 to connect as the **admin role** rather than `hypercare_app`, because only operators run it and we want the ability to `published = true` without ambiguity about grants.
- Reuse the existing `@alongside/db` package and Drizzle client. Do **not** open a raw `postgres-js` connection inside `packages/content/`.
- Connection URL resolution:
  - Read from env var `DATABASE_URL_ADMIN` (new for this task — document in `docs/infra-runbook.md`).
  - If unset, fail with a clear error that names the SSM tunnel script (`./scripts/db-tunnel.sh`) and the Secrets Manager path where admin creds live. Do not fetch the secret value automatically — the operator pastes it into their env.
- Wrap the upsert for each module in a single transaction: delete-then-insert the chunks is acceptable if the idempotency hash check happens **inside** the transaction. Simplest correct implementation wins.

---

## Acceptance criteria

- `pnpm --filter @alongside/content load` exits 0 against a reachable DB.
- Querying the DB (via `psql` through the tunnel, or via a throwaway Drizzle script) shows:
  - Exactly 3 rows in `modules` with the three slugs above, `published = true`.
  - `module_chunks.module_id` FKs resolve; chunk counts per module are in the 3–8 range for v0 bodies.
  - Every `embedding` value has length 1024.
  - Every `module_chunks.metadata` has a non-null `content_hash` and `section_heading`.
- Second run of the loader:
  - Does not change `modules.created_at` (uses ON CONFLICT DO UPDATE, not DELETE + INSERT for the modules row itself).
  - Does not call Bedrock for any chunk whose `content_hash` is unchanged. Prove this by logging `"skip <slug> chunk <n> (hash match)"` or similar and showing the log in the report-back.
- `zod` validation catches:
  - Unknown `category` values (not in the 7 CHECK values).
  - Non-kebab-case slugs.
  - `tier` outside {1, 2, 3}.
  - `stage_relevance` entries outside {"early", "middle", "late"}.
- `pnpm -w typecheck && pnpm -w lint` pass from repo root.
- No secret values in git, logs, or the ADR.

---

## Files to create / modify

### Create

```
content/modules/behavior-sundowning.md
content/modules/daily-bathing-resistance.md
content/modules/self-care-caregiver-burnout.md

packages/content/package.json
packages/content/tsconfig.json
packages/content/src/index.ts            # barrel
packages/content/src/schema.ts           # zod front-matter schema + types
packages/content/src/parse.ts            # front-matter + body parse (use `gray-matter`)
packages/content/src/chunk.ts            # section-then-overflow chunker
packages/content/src/embed.ts            # Bedrock Titan v2 client wrapper
packages/content/src/upsert.ts           # Drizzle writes
packages/content/src/cli.ts              # CLI entry, thin glue

docs/adr/0006-content-pipeline-v0.md
```

### Modify

```
pnpm-workspace.yaml                      # add packages/content (only if not glob-covered)
docs/infra-runbook.md                    # add DATABASE_URL_ADMIN + how to get it; add "Seeding content" subsection
TASKS.md                                 # flip this task to in-progress → done
```

### Do **not** touch

- `apps/web/**` — no web UI work in this task. Retrieval and display come later.
- `packages/rag/**` — leaving that package empty for TASK-009.
- `packages/db/src/schema/**` — schema is frozen for v0. If the chunker genuinely needs a new column, stop and flag it in the report-back; do not add it silently.

---

## Out of scope (do not do)

- Retrieval / query-time code. That is TASK-009.
- The safety classifier. That is TASK-010.
- Any home / conversation UI. That is TASK-011.
- Authoring the full tier-1 module library — only the 3 pilots.
- Re-ranking, hybrid search, BM25, keyword fallback.
- Evaluation harness / retrieval quality metrics — TASK-012.
- Expert reviewer workflow, review-date enforcement, `next_review_due` alerts. v0 allows null reviewer.
- Multilingual / translation.
- Streaming the body from S3 or a CMS. Files-in-repo is intentional for v0.

---

## How PM verifies after Cursor reports back

1. `ls content/modules/` shows the three files; `head -20` each confirms front-matter validates against the documented fields.
2. Run the SSM tunnel, set `DATABASE_URL_ADMIN`, run `pnpm --filter @alongside/content load`. It exits 0.
3. Through the tunnel in `psql`:
   ```sql
   select slug, category, tier, array_length(stage_relevance, 1) as stages, published from modules order by slug;
   select m.slug, count(mc.*) as chunks, min(array_length(mc.embedding::real[], 1)) as dim
     from modules m join module_chunks mc on mc.module_id = m.id
     group by m.slug order by m.slug;
   ```
   Expect: 3 modules, all `published=true`, all `dim=1024`, chunk counts in a sensible range.
4. Run the loader a second time immediately. Expect the log to show content-hash skips for every chunk and zero Bedrock calls.
5. Read `docs/adr/0006-content-pipeline-v0.md` — it should answer "why chunk this way", "why Titan v2", "why files-in-repo".

---

## Decisions already made (do not relitigate)

- **Embedding model:** `amazon.titan-embed-text-v2:0` at 1024 dims. The schema column is already `vector(1024)` — this is the contract.
- **Region:** `ca-central-1` for both Bedrock and Postgres. Do **not** introduce a second region.
- **Content storage:** files in the repo under `content/modules/`, not S3 or a CMS. v0 privileges reviewability and diffs over scale.
- **Chunker:** heading-first, overflow on paragraphs, 60-token overlap. Not a sentence-window chunker, not a semantic chunker.
- **Write role:** admin DB role for the loader (operator tool). App runtime will continue to use `hypercare_app`, which this task does **not** touch.
- **`expert_reviewer` / `review_date`:** nullable in v0. The tier-1 launch will require these; creating the ticket for that is not in scope here.
- **Idempotency key:** SHA-256 of `title + "\n" + chunk_content`, stored in `module_chunks.metadata.content_hash`.

---

## Questions for PM before starting (ask before writing code if unresolved)

1. **Pilot bodies.** Do you have prose for the three modules yet? If not, Cursor should stub `TODO(PM)` bodies of ~500 words each (plausible placeholder content clearly marked) so the pipeline can be exercised end-to-end. PM replaces bodies before TASK-009 starts.
2. **Bedrock access in `ca-central-1`.** Titan Text Embeddings v2 must be **enabled** in the region for your AWS account. If the first embed call returns `AccessDeniedException` mentioning model access, stop and flag — enabling it is a console action (Bedrock → Model access → Titan Text Embeddings V2) and belongs to the PM-operator, not Cursor.

---

## Report-back (PROJECT_BRIEF §7 format)

In the final comment, include:

- Paths of the 8 new source files under `packages/content/`, plus the 3 module files and the ADR.
- Chunk counts per module from the first successful run.
- Second-run log excerpt proving hash-skip (one line per chunk is enough).
- Any `TODO(PM)` markers left in the 3 module bodies.
- Anything the idempotency or schema contract made you want to change in `packages/db/` — flagged, not done.
- Diff of `docs/infra-runbook.md` (the new `DATABASE_URL_ADMIN` subsection).
