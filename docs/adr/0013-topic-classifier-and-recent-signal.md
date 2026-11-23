# ADR 0013 — Topic classifier and recent-topics signal (TASK-022)

## Status

Accepted (Sprint 2).

## Context

The home screen “this week’s focus” card should not depend only on care stage: many middle-stage caregivers would see the same lesson. The differentiator is **what the user has been asking about recently** (PRD §6.3). TASK-019 introduced a **closed** `topics` table (slugs, categories, display names) so downstream features can join to `module_topics` deterministically. The RAG layer already sends every question to Bedrock; we need a **durable, queryable** topic signal without re-LLM-ing on every read.

## Decisions

### 1. Closed vocabulary = seeded `topics.slug` only

The classifier is prompted with the full v0 list (`slug` + one-line `display_name` + `category`, loaded at process boot from the same data as `TOPICS_V0` / the DB seed). The model may propose at most **three** slugs, in relevance order, from that list. Anything else is **filtered out** and logged (`rag.topics.classifier.off_vocab_slug`). The §7.1 module **categories** are coarser; we do **not** persist category on the message row—derive it from the slug via `topics.category` when needed.

### 2. Per-turn classification, not re-classify on `getRecentTopicSignal` reads

We store `classified_topics` (jsonb `string[]`) and `topic_confidence` (real) on each **user** `messages` row at write time (same request as `rag.answer`, via `AnswerResult` → `persistTurn`). Rereading the raw text and re-invoking the LLM for every picker query would be slower, costlier, and non-deterministic relative to the answer the user already saw. The signal function is a **pure aggregate** over stored rows.

### 3. Up to three tags per message, but the signal uses **top-1** per message

The model can return 0–3 slugs. The `getRecentTopicSignal` weighting step uses only `classified_topics[0]` for each user message, so a noisy multi-label turn does not dominate the 14-day sum.

### 4. Recency: exponential decay with 7-day scale

For each user message, we add a weight `exp(-age_days / 7)` to the top-1 slug, then sum by slug, then **normalize** so the top slug has `weight = 1.0` and return the top 5. The 7 in the exponent is a **tunable** half-life-like scale (not a hard window—the window is 14 days). A message from “yesterday” is materially more important than one from 13 days ago, without zeroing the latter.

### 5. Failure mode: never block the answerer

Topic classification is started at the start of `runPipeline` in parallel with layer work; the answer path does not **await** the topic LLM before retrieval/generation. The return path **awaits** the topic result (or an empty/safe outcome) so the API can persist slugs in the same `persistTurn` as the user message. If Bedrock or parsing fails, we log with `warn` and persist `[]` and `null` for confidence.

## Consequences

- Picker code (TASK-024) can call `getRecentTopicSignal(userId)` with no additional Bedrock cost.
- Historical messages from before this migration have empty `classified_topics`; the signal degrades when `messagesConsidered` is small.
- Retrieval and grounding are **unchanged** in v0; topics do not influence chunk selection in this task.

## References

- `tasks/TASK-022-recent-topics-classifier.md`
- ADR 0008 — RAG pipeline v0 (orchestrator layers; topic is adjacent to but does not change retrieval).
- `packages/rag/src/topics/`
