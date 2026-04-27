# ADR 0008 — RAG pipeline v0 (TASK-009)

## Status

Accepted (Sprint 1 vertical slice).

## Context

PRD §8 commits Hypercare to **grounded answers, not generated ones**. PRD §9 sketches a 7-layer pipeline (safety → understand → retrieve → ground → compose → generate → verify). TASK-008 already populated `modules` and `module_chunks` with Titan v2 embeddings. TASK-009 turns those rows into answers and ships the library that TASK-011 will wire into the UI.

This ADR captures the choices made in v0 so reviewers — and the eval harness in TASK-012 — know which knobs are deliberate vs. placeholder.

## Decisions

### 1. Six named layers + one safety stub, each in its own file

Six functions (`1-understand` … `6-verify`) plus `0-safety` (stub for TASK-010), each a pure async function with typed input and output. The orchestrator (`pipeline.ts`) is a flat top-to-bottom call sequence with no hidden state. Why:

- **Testability**: each layer can be unit-tested with fixtures; integration tests only exist for layers 2 and 5 (DB + Bedrock).
- **Eval surface**: TASK-012 can swap or instrument any single layer without monkey-patching neighbours.
- **PRD readability**: the 7-layer language in PRD §9 maps 1:1 to file names. New contributors can find "where does grounding live?" in five seconds.

The six layers expose internals via a `Deps` object (`embed`, `search`, `loadStage`, `generate`). The default wiring lives in `deps.ts`. Tests build their own `Deps` and never touch real services.

### 2. Refusal taxonomy is a discriminated union

`RefusalReason` carries a machine-readable `code`:

- `no_content` — zero hits returned (rare; means the corpus is empty for this stage).
- `low_confidence` — top-1 distance > 0.40, **or** fewer than 3 hits within 0.60, **or** the model emitted `INSUFFICIENT_CONTEXT`.
- `off_topic` — top-1 distance > 0.85; we tag the nearest module's category for telemetry.
- `uncitable_response` — layer 6 found a claim sentence with no `[n]` citation (or an out-of-range `[n]`). We never silently rewrite the model's text.
- `safety_triaged` — TASK-010 placeholder (`classifier: "pending"` until that task lands).
- `internal_error` — caught throw inside the pipeline. Always returned as a refusal so callers don't need try/catch.

Refusals are **first-class return values, not thrown errors**. Layer 3 and layer 6 are the only producers (plus the safety stub and the orchestrator's catch-all). UI wiring (TASK-011) will map each `code` to user-facing copy.

### 3. k = 6, top-1 ≤ 0.40, secondary ≥ 3 hits within 0.60

These thresholds are heuristic placeholders that TASK-012 will tune with evals. Reasoning for v0:

- **k = 6** keeps the prompt small (we forward at most `maxChunksForPrompt = 4` to the model) while giving layer 3 enough material to choose from when one chunk is anomalously close.
- **0.40 / 0.60 / 3 hits** are eyeballed: Titan v2 normalized embeddings on this corpus tend to land high-relevance hits in `[0.10, 0.35]` and noise around `[0.55, 0.85]`. Requiring a tight top-1 *and* a small cluster of supporting hits reduces "one lucky shard" false positives.
- **off-topic at > 0.85** isolates the "wrong topic entirely" case for cleaner telemetry, separate from "right topic but weak phrasing".

All four numbers are exported from `config.ts` and overridable via `withConfig({...})`.

### 4. Claude Haiku 4.5 for generation, not Titan Text

- Bedrock **inference profile** id: `us.anthropic.claude-haiku-4-5-20251001-v1:0` (Americas system profile; [model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-4-5.html)). Raw `anthropic.claude-haiku-4-5-20251001-v1:0` is often rejected in `InvokeModel` with “on-demand throughput isn’t supported” — AWS expects the regional **us./eu./au./global.** profile for many Anthropic models. Runtime region remains `ca-central-1`. TASK-009 originally named Claude 3.5 Sonnet; we use **Haiku 4.5** for cost/latency on the pilot slice; same Messages API and citation contract.
- `temperature = 0.2`, `max_tokens = 600`. We want near-deterministic retrieval-grounded prose, not creative writing.
- We did **not** use Amazon Titan Text Generation. Claude follows the "cite-or-refuse" instruction reliably, and the `INSUFFICIENT_CONTEXT` escape hatch is well-documented in Anthropic's prompting guide.
- The Bedrock client lives in `bedrock/claude.ts` as a thin `InvokeModel` wrapper — no streaming, no tool use, no retries. Streaming is a TASK-011 follow-up if UX demands it.

### 5. No re-ranker, no hybrid search, no query decomposition in v0

We deliberately did not add:

- Cohere/BGE/cross-encoder re-ranking.
- BM25 hybrid retrieval.
- Self-query / multi-hop decomposition.

Each of these adds latency and operational surface area. The pilot corpus is small (TASK-008 ships ~10 modules); pgvector cosine top-k is enough to validate the *shape* of the pipeline. The ADR for v1 (post-eval) will revisit re-ranking first since it's the cheapest meaningful win.

### 6. Stage filter uses `metadata->'stage_relevance'` jsonb path, not a denormalized column

Per PRD §5 ↔ §9, retrieval is stage-aware. We filter at SQL time using `metadata->'stage_relevance' @> to_jsonb($stage::text)` (or empty-array passes). This keeps the schema unchanged (TASK-004 froze it) and lets the eval harness inspect the same metadata blob the loader writes.

The stage itself is loaded via a new `care/profile.ts` helper that queries `care_profile.stage_answers` and applies a copy of `inferStage`. We did **not** import `loadProfileBundle` from `apps/web/src/lib/onboarding/status.ts` because that module is `server-only` Next.js code and `@alongside/rag` must remain consumable from CLIs and (eventually) eval harnesses. The duplicated `inferStage` carries a `TODO(extract)` comment pointing at a future shared `@alongside/onboarding` package; both copies must move together until then.

### 7. PII scrub is best-effort, not a privacy boundary

Layer 1 strips emails, 10–11 digit phone-like runs, and 4+ digit number runs from the question **before** it is embedded or sent to the model, replacing each match with `<redacted>`. The original is preserved on the output for the citation log. Scrub rules:

- Emails: `/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/`
- Phones: `/(?:\+?\d[\s().-]?){10,11}/`
- Other digit runs ≥ 4 chars: `/\b\d{4,}\b/`

False positives (e.g. dosage `400`) are accepted. The actual privacy boundary is the auth wall + TOS. The scrub exists to reduce accidental prompt-logging and Bedrock-side telemetry of PII. PM confirmed this is acceptable for v0.

### 8. Prompt templates are checked-in `.md` files

`src/prompts/system.md` and `src/prompts/user-template.md` are read once at module load by `prompts/loader.ts`. We do not inline prompts in TS so PM can review them as text and the eval harness can A/B prompts by replacing files. A `postbuild` step (`scripts/copy-prompts.mjs`) copies them into `dist/prompts/` so consumers of the published package get them too.

## Consequences

- All thresholds are tunable from one place (`config.ts`); evals can sweep them without touching layer code.
- The `safety_triaged` code is a placeholder until TASK-010 ships; the orchestrator already handles it, so TASK-010 is a one-file replacement.
- **Operator logging on `internal_error`:** The pipeline catch-all still returns `{ code: "internal_error", detail }` to the client (no stack traces in the API contract), but it also invokes `deps.warn("rag.pipeline.internal_error", { errMessage, errStack, errName, userId, questionPreview })` so operators get structured logs in CloudWatch or the server console. Default wiring uses `console.warn` like the safety package’s `warn` hook. See `packages/rag/src/pipeline.ts`.
- **Generation token usage (TASK-017):** On `kind: "answered"`, `AnswerResult` includes `usage: { inputTokens, outputTokens, modelId }` from Bedrock’s reported usage after layer 5. The same values are also emitted to `deps.onUsage` after generation whenever the model ran, including when layer 6 returns a refusal (e.g. `uncitable_response`), so cost pipelines can log without a second client. This is **operator-facing telemetry**, not a user-facing metric; the chat UI does not render it, but it is safe to include in server responses for observability and eval reports.
- The duplicated `inferStage` is debt (tracked by TODO comment + this ADR) — the next time a third package needs the rule, extract a shared package.
- We accept that re-ranking is missing; v1 should land it before opening the corpus past the pilot.
- The `stage_relevance` jsonb filter assumes the loader writes an array. The loader's tests guarantee this; the search SQL also defensively gates on `jsonb_typeof(...) = 'array'`.
- **Topic labels (TASK-022):** User turns now carry `classified_topics` + `topic_confidence` (see [ADR-0013](./0013-topic-classifier-and-recent-signal.md)). Classification runs in parallel with the rest of the pipeline; it does not change retrieval in v0.

## References

- PRD §8 (grounded over generated), §9 (7-layer pipeline), §10 (safety classifier).
- ADR 0002 — Drizzle schema v0 (vector(1024) contract).
- ADR 0005 — Onboarding stage rules (stage is internal, never shown).
- ADR 0006 — Content pipeline v0 (Titan v2 + ingest invariants).
- `tasks/TASK-009-rag-pipeline.md`.
- `tasks/TASK-010-safety-classifier.md` (replaces layer 0 stub).
- `tasks/TASK-011-home-conversation-ui.md` (consumes `answer()`).
- `tasks/TASK-012-eval-harness.md` (tunes thresholds).
- [ADR-0013](./0013-topic-classifier-and-recent-signal.md) — topic classifier + `getRecentTopicSignal` (vocabulary, persistence, recency).
