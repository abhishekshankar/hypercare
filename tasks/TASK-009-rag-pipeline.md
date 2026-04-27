# TASK-009 — Retrieval pipeline v0: query → retrieve → ground → answer → attribute

- **Owner:** Cursor
- **Depends on:** TASK-004 (schema), TASK-006 (auth/session), TASK-007 (care_profile + stage inference), TASK-008 (seeded modules + chunks + embeddings)
- **Status:** pending
- **ADR:** `docs/adr/0008-rag-pipeline-v0.md` (new, written as part of this task)

---

## Why this exists

Hypercare's promise is grounded answers, not generated ones (PRD §8, §9). TASK-008 seeded real content and embeddings. This task turns those chunks into answers. The answer path must:

1. Embed the user's question with the same Titan v2 model used at ingest.
2. Retrieve top-k chunks via pgvector cosine similarity, filtered by the user's inferred stage from `care_profile.stage_answers`.
3. Decide whether retrieval is good enough to answer (the "grounding check"), and if not, return a refusal with a clear reason — never fall through to un-grounded generation.
4. Compose a prompt that forces the model to cite chunks by ID.
5. Call the answering model and verify every claim in the response maps back to a retrieved chunk (post-generation verification).
6. Return `{ answer, citations[], refusal? }` — attribution is structured, not prose.

This is deliberately a **v0** of PRD §9's 7-layer architecture. Layers exist as named functions so TASK-012 can eval them independently. We are not building re-ranking, hybrid search, or self-query decomposition in v0.

---

## Context to read first

1. `PROJECT_BRIEF.md` §7 (reporting format), §8 (secrets rule).
2. `prd.md` §8 (grounded over generated), §9 (the 7-layer pipeline — read the whole section), §10 (safety classifier — this task does NOT implement it; TASK-010 does. But layer 0 is a stub hook.).
3. `packages/db/src/schema/module-chunks.ts` and `packages/db/src/schema/modules.ts` — retrieval targets. Vector column is `vector(1024)`, cosine HNSW index already exists (`module_chunks_embedding_hnsw`).
4. `apps/web/src/lib/onboarding/stage.ts` and `apps/web/src/lib/onboarding/status.ts` — `inferStage(answers)` returns `"early" | "middle" | "late" | null`; `loadProfileBundle(userId)` returns care_profile + displayName.
5. `packages/content/src/embed.ts` — the Titan v2 wrapper. **Reuse it, don't reimplement.**
6. `docs/adr/0006-content-pipeline-v0.md` — confirms Titan v2 at 1024 dims is the contract.
7. `tasks/TASK-008-content-loader.md` — for the chunk metadata shape (`section_heading`, `stage_relevance`, `content_hash`).

---

## What "done" looks like

1. `packages/rag/` is populated — no longer an empty stub.
2. A function `answer(input): Promise<AnswerResult>` is the single public entry point, where
   - `input = { question: string, userId: string }`
   - `AnswerResult = { kind: "answered", text, citations: Citation[] } | { kind: "refused", reason: RefusalReason }`
3. Six named internal layers, each in its own file, each independently unit-testable:
   - `packages/rag/src/layers/0-safety.ts` — **stub hook** that always returns `{ triaged: false }` in this task. TASK-010 replaces the body.
   - `packages/rag/src/layers/1-understand.ts` — normalizes the question (trim, lower-case for retrieval-only comparisons, strip PII-looking patterns per below).
   - `packages/rag/src/layers/2-retrieve.ts` — embeds the question, runs pgvector ANN search, returns top-k hits with distances and stage filter applied.
   - `packages/rag/src/layers/3-ground.ts` — decides whether retrieval is "good enough" (see thresholds below). Returns either a go-ahead with the chunks to use, or a refusal reason.
   - `packages/rag/src/layers/4-compose.ts` — builds the system + user prompt, injecting chunks as numbered sources `[1]..[k]`.
   - `packages/rag/src/layers/5-generate.ts` — calls the answering model (Bedrock — model id from `ANSWER_MODEL_ID` in config; see “Model for generation”), gets back text + raw usage.
   - `packages/rag/src/layers/6-verify.ts` — post-gen checks: every `[n]` citation in the text must be a real retrieved chunk; every claim-bearing sentence must have at least one citation; if a sentence lacks a citation, strip it or refuse (see "Verification rules").
4. Each layer is a pure async function with typed input/output — **no hidden singletons, no module-level state.** A test can import a single layer, feed it a fixture, and assert.
5. A thin orchestrator `packages/rag/src/pipeline.ts` wires the six layers together in order. `answer()` in `index.ts` is a one-line call into `pipeline.ts`.
6. Unit tests for every layer under `packages/rag/test/`, using Vitest. Layer 2 and 5 are integration tests behind a `RAG_LIVE=1` env guard (they hit Bedrock / the DB); default unit tests use mocks so CI is offline-clean.
7. A new ADR `docs/adr/0008-rag-pipeline-v0.md` captures: the 6-layer split, refusal taxonomy, k and threshold choices, why Claude not Titan Text for generation, why no re-ranking in v0.
8. `apps/web` does **not** import this package yet. Wiring `answer()` into a route / UI is TASK-011. This task ships the library only.

---

## Stage filtering (PRD §5 ↔ §9)

Retrieval is stage-aware:

- Call `inferStage(profile.stage_answers)` to get the user's stage (or `null`).
- Stage filter rule:
  - If stage is `"early" | "middle" | "late"`: include chunks whose `metadata->>'stage_relevance'` array contains the stage **or** is the empty array (stage-agnostic content).
  - If stage is `null` (not enough answers): no stage filter — retrieve across everything.
- Stage is **never** shown to the user, in line with ADR 0005. It only shapes retrieval.

`care_profile` lookup uses `loadProfileBundle(userId)` — do not reimplement.

---

## Retrieval parameters (v0)

| Knob | Value | Why |
|------|-------|-----|
| `k` | 6 | Small enough the answering model's context stays cheap; large enough that layer 3 has material to pick from. |
| Distance metric | `<=>` (cosine) | Matches the HNSW index operator class `vector_cosine_ops`. |
| Grounding threshold | Top-1 distance `<= 0.40` AND at least 3 hits with distance `<= 0.60` | Values are heuristics; TASK-012 will tune them. |
| Max chunks passed to layer 4 | 4 | Keeps prompt small; layer 3 picks the best 4 from `k=6`. |
| Embed dims | 1024 | Contract from TASK-008. Assert. |

All thresholds live in `packages/rag/src/config.ts` as named exports so evals can override them.

---

## Refusal taxonomy

`RefusalReason` is a discriminated union. Layer 3 and layer 6 are the only producers. UI / TASK-011 will map these to user-facing copy.

```ts
type RefusalReason =
  | { code: "no_content"; message: string }                 // 0 hits at all
  | { code: "low_confidence"; top_distance: number }        // hits too far
  | { code: "off_topic"; matched_category: string | null }  // nearest chunk is a wildly wrong category
  | { code: "uncitable_response"; stripped_sentences: number } // layer 6: the model answered without citing
  | { code: "safety_triaged"; classifier: "pending" }       // placeholder; TASK-010 fills real codes
  | { code: "internal_error"; detail: string };
```

**Never refuse silently.** Every refusal returns a `reason` object the UI can show.

---

## Verification rules (layer 6)

- Extract every `[n]` bracket citation from the generated text.
- If `n` is outside `[1..len(chunks_passed_to_compose)]`, the citation is invalid → refuse with `uncitable_response`.
- Split the answer into sentences (simple regex split on `. `, `? `, `! ` is fine for v0).
- A sentence is "claim-bearing" if it is not an interjection / greeting / hedge. Heuristic: length ≥ 40 chars AND contains a verb token (regex `\b(is|are|was|were|can|may|should|try|avoid|use|ask|tell|reduce|increase|call|remember|help|know|feel|causes|caused|happens|happen)\b` — explicit, not ML).
- Every claim-bearing sentence must contain at least one `[n]` citation. If ≥1 sentence fails, refuse with `uncitable_response` and include `stripped_sentences` count.
- Convert `[n]` citations into a `Citation[]` array: `{ chunkId, moduleSlug, sectionHeading, attributionLine }`. UI renders from this array, not from the raw text.

Verification must run on a string the model produced — do **not** run it on a regenerated / post-edited version. We'd rather refuse than silently rewrite the model's answer.

---

## Model for generation

- **Answering model id is defined only in `packages/rag/src/config.ts` as `ANSWER_MODEL_ID` (and mirrored on `DEFAULT_CONFIG.answerModelId` for eval overrides).** Layer 5 and `bedrock/claude.ts` consume that value — **do not** pin a literal model id in a layer, in this task file, or in the ADR as the single source of truth; the ADR describes the *class* of choice (Haiku vs Sonnet, inference profile vs bare id). PM and operators change generation by editing `config.ts` or setting `BEDROCK_ANSWER_MODEL_ID` at deploy time.
- **Bedrock inference profile (lesson from live testing):** For Anthropic chat models, `InvokeModel` with a bare `anthropic.*` model id often returns *on-demand throughput isn’t supported* — you must use a **system inference profile** id such as the regional **`us.`** / `eu.` / `au.` prefix (or `global.` where documented). For `ca-central-1`, the working default is the **Americas (`us.`) profile** whose name matches the Haiku 4.5 model in the Bedrock console — **exact string lives in `ANSWER_MODEL_ID` in config, not here.** If your account only exposes a different profile, set `BEDROCK_ANSWER_MODEL_ID` (or change `ANSWER_MODEL_ID` in config); do not scatter alternate literals in code.
- **Region:** `ANSWER_REGION` in config (default `ca-central-1`).
- Max output tokens: `ANSWER_MAX_TOKENS` (default 600 in v0).
- Temperature: `ANSWER_TEMPERATURE` (default 0.2) — we want near-deterministic retrieval-grounded answers, not creative writing.
- System prompt template lives in `packages/rag/src/prompts/system.md` (checked in, reviewed by PM). User prompt template lives in `src/prompts/user-template.md`. Layer 4 reads these files at module load — do not inline the prompts in TS.

**Do not** add a second embedding model, a re-ranker, or hybrid BM25 in this task. Add TODO comments pointing at future-tasks instead.

---

## PII normalization (layer 1)

Best-effort only — not a privacy boundary. Scrub these from the question **before** it is embedded or sent to the model, replacing with `<redacted>`:

- Email addresses (simple regex).
- 10- or 11-digit phone number runs.
- Sequences of 4+ digits that look like a birth year or SIN-like number.

Keep the original question on the returned object as `input.question` for the citation log; only the **embedding input** and **prompt input** use the scrubbed version. Document the scrub rules in the ADR.

---

## Acceptance criteria

- `pnpm --filter @alongside/rag typecheck && pnpm --filter @alongside/rag lint && pnpm --filter @alongside/rag test` all green.
- Running `answer({ question: "my mom gets agitated every afternoon, what do i do?", userId: <seed-user-id> })` against a DB seeded by TASK-008 returns `{ kind: "answered", text: <string with [n] citations>, citations: [...] }`.
- Running `answer({ question: "what is the capital of france?", userId: <seed-user-id> })` returns `{ kind: "refused", reason: { code: "low_confidence" | "off_topic" | "no_content", ... } }`. Never a hallucinated answer.
- Stage filter is verifiable: seeding a user whose `stage_answers` imply `late` causes a behavior-sundowning chunk (tagged `["early","middle"]`) to be **excluded**; seeding a user whose answers imply `early` or `middle` causes it to be included.
- Every returned citation references a real row in `module_chunks`, with module_slug resolvable via FK.
- Unit tests cover each layer individually with fixtures; integration tests gated on `RAG_LIVE=1`.
- ADR 0008 exists and answers the six bullet points above.

---

## Files to create / modify

### Create

```
packages/rag/src/index.ts                # re-export answer()
packages/rag/src/types.ts                # AnswerInput, AnswerResult, Citation, RefusalReason, Chunk
packages/rag/src/config.ts               # k, thresholds, max_chunks, model id
packages/rag/src/pipeline.ts             # orchestrator
packages/rag/src/layers/0-safety.ts
packages/rag/src/layers/1-understand.ts
packages/rag/src/layers/2-retrieve.ts
packages/rag/src/layers/3-ground.ts
packages/rag/src/layers/4-compose.ts
packages/rag/src/layers/5-generate.ts
packages/rag/src/layers/6-verify.ts
packages/rag/src/prompts/system.md
packages/rag/src/prompts/user-template.md
packages/rag/src/bedrock/claude.ts       # thin wrapper around Bedrock InvokeModel
packages/rag/test/*.test.ts              # one per layer + pipeline.test.ts
docs/adr/0008-rag-pipeline-v0.md
```

### Modify

```
packages/rag/package.json                # add deps: @alongside/db, @alongside/content, @aws-sdk/client-bedrock-runtime, zod, drizzle-orm
packages/rag/tsconfig.json               # enable composite / test config as needed
TASKS.md                                 # flip status
```

### Do **not** touch

- `apps/web/**` — wiring is TASK-011.
- `packages/safety/**` — classifier is TASK-010. This task only installs the stub hook inside `rag/src/layers/0-safety.ts`.
- `packages/db/src/schema/**` — schema is frozen.
- `packages/content/**` — reuse its `embed()` for question embedding; do not modify.

---

## Out of scope (do not do)

- The actual safety classifier — TASK-010.
- Any `/api/app/chat` route or UI — TASK-011.
- Re-ranking, hybrid search, BM25, query decomposition, multi-hop.
- Streaming tokens back to the client.
- Persisting conversations / messages to the `conversations` / `messages` tables. TASK-011 owns that.
- Eval harness / automated quality metrics — TASK-012.
- Prompt injection defense beyond the structural "only cite retrieved chunks" rule. Adversarial hardening is a follow-up.

---

## How PM verifies after Cursor reports back

1. `pnpm --filter @alongside/rag test` passes offline (no network).
2. With DB seeded and Bedrock reachable, a tiny scratch script (e.g. `packages/rag/scripts/smoke.ts` — Cursor adds it if it wants) runs `answer()` for the three golden questions and prints the result:
   - "my mom gets agitated every afternoon" → answered, cites sundowning chunks.
   - "how do I deal with bathing resistance" → answered, cites daily-bathing chunks.
   - "what is the capital of france" → refused.
3. Read the ADR — it should answer why k=6, why threshold 0.40, why the default answering model (Haiku + inference profile) with layer-6 verification as the safety net, why no re-ranker.

---

## Decisions already made

- Six named layers, not one monolithic function. Testability > compactness.
- Refusal is a first-class return value, not a thrown error.
- Titan Text Embeddings v2 at 1024 dims for the question — **same model as ingest**, non-negotiable.
- **Default answering model:** Claude Haiku 4.5, **id read only from `ANSWER_MODEL_ID` in `packages/rag/src/config.ts`**, using a **Bedrock system inference profile** (e.g. regional `us.*` — see “Model for generation” and ADR 0008; never rely on a bare `anthropic.*` id if the account rejects on-demand). Titan Text Generation is not used anywhere in v0.
- **Verification as the safety net (why Haiku is acceptable as default):** Grounding is enforced by **layer 3** (retrieval quality) and **layer 6** (every claim-bearing sentence must cite a retrieved source `[n]`; invalid or missing citations → refuse, not silent rewrite). The model does not get a “free pass” to hallucinate: a smaller/faster model trades away some fluency, but **uncited or out-of-range answers are refused**. If TASK-012 shows too many `uncitable_response` or quality issues, we can move `ANSWER_MODEL_ID` to Sonnet or another profile without changing layer shape.
- Prompt templates are checked-in files, not inline strings.
- No rerank / no hybrid search in v0.
- Stage filter uses `metadata->>'stage_relevance'` jsonb path, not a denormalized column.

---

## Questions for PM before starting

1. **Bedrock (only if blocked):** Model access and inference profiles for the id in **`ANSWER_MODEL_ID`** have already been cleared for this project’s AWS account; Cursor should **not** re-run enablement. If a build or `bedrock-check` / smoke fails with `ValidationException` (e.g. *on-demand throughput isn’t supported*), **then** stop and flag: the fix is the correct **inference profile** id (`us.` / `global.` / custom application profile) in config or `BEDROCK_ANSWER_MODEL_ID`, or IAM `bedrock:InvokeModel` — a PM/operator console or deploy-time change, not a code chase for “is Bedrock on?”
2. **PII scrub: is best-effort redaction acceptable for v0?** It is **not** a privacy boundary; actual boundary is the TOS + auth wall. The scrub exists to reduce accidental prompt-logging of emails / phones.

---

## Report-back

- File list (should be ~15 new files + the ADR).
- Output of the three-question smoke run.
- k / threshold values actually chosen if different from above, and why.
- Any layer that turned out to need state you didn't expect, flagged.
- Test counts per layer.
