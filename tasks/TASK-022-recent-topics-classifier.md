# TASK-022 — Topic classifier + recent-topics signal for the lesson picker

- **Owner:** Cursor
- **Depends on:** TASK-009 (RAG pipeline already has a query classifier; reuse the classifier infrastructure), TASK-019 (`topics` reference table is the closed vocabulary)
- **Unblocks:** TASK-024 (the picker calls `getRecentTopicSignal(userId)`)
- **Status:** in_review
- **ADR:** `docs/adr/0013-topic-classifier-and-recent-signal.md` (new)

---

## Why this exists

The PRD's §6.3 home screen describes the "this week's focus" card as a system-picked module that reflects "the profile and what the user has asked recently." Stage + profile alone is too coarse — every middle-stage caregiver would see the same lesson. The differentiator is **what the user has been asking about this week.**

Sprint 1's RAG pipeline already does Layer 2 query understanding (PRD §9.2 Layer 2) — topic / urgency / stage-relevance / safety. But:

1. The output isn't persisted, so we can't aggregate over time.
2. The "topic" output is loose-string today; the picker needs a closed vocabulary so it can join against `module_topics` (TASK-019).

This task does three things:

1. Define the closed topic vocabulary as the seeded `topics.slug` set (per TASK-019).
2. Persist the topic classification per user message (new column on `messages`).
3. Expose `getRecentTopicSignal(userId)` from `packages/rag` (or a new tiny package) that returns a small ranked list of topics the user has been asking about in the last 14 days.

---

## Context to read first

1. `prd.md` §6.3 (home screen — "this week's focus" intent), §7.1 (the seven §7.1 categories — the topic vocabulary is finer than this), §9.2 Layer 2 (existing query classifier).
2. `packages/rag/src/pipeline.ts` — Layer 2 classifier integration point.
3. `packages/safety/src/classify.ts` — same shape we're adding for topics. Mirror its pattern (rule + LLM with a structured-output prompt).
4. `packages/db/src/schema/messages.ts` — we add columns here.
5. After TASK-019 lands: `packages/db/src/schema/topics.ts` — the closed vocabulary lives here.
6. `docs/adr/0008-rag-pipeline-v0.md` — Layer 2 design rationale; this task extends it.

---

## What "done" looks like

### Topic classifier (`packages/rag/src/topics/`)

- A small classifier callable from inside Layer 2 of the existing pipeline.
- Input: `{ userId, question }` (and optionally the last 1 user turn for short-followup disambiguation — `she's still doing it` → use the prior turn's topic).
- Output: `{ topics: string[], confidence: number }` where `topics` is **0–3** entries from the seeded `topics.slug` set, ordered most-relevant first.
- Implementation: structured-output Bedrock call (Haiku tier, same model family as the existing safety/classifier work). The system prompt loads the topic table at boot — `slug` + one-line `display_name` + `category` — and instructs the model to **only** output slugs present in that list, returning `[]` when nothing fits.
- Default deps wire to the existing Bedrock client; the classifier accepts an `invoke` dep for unit testing.
- Empty / whitespace input short-circuits to `{ topics: [], confidence: 0 }` (mirror TASK-018's pattern).

### Persistence

A migration adds two columns to `messages`:

```
classified_topics  jsonb not null default '[]'::jsonb     -- string[]
topic_confidence   real null                              -- 0..1
```

`classified_topics` is non-empty only on `role = 'user'` rows (assistant rows have `[]`).

The pipeline writes these on every user-turn ingestion — extend `runPipeline` (or the route handler that calls it) to call the topic classifier in parallel with the safety classifier (Layer 0) and persist the result on the user's `messages` row before generation. **Do not block answer generation on topic classification** — fire it in parallel, await before persistence, but if it errors, log via the `warn` deps hook (TASK-016 added it) and persist `[]` + null.

### `getRecentTopicSignal(userId)`

Exported from `packages/rag/src/topics/signal.ts`:

```ts
export interface RecentTopicSignal {
  topTopics: { slug: string; weight: number }[]; // ranked, weight in [0, 1], up to 5
  windowDays: number;                            // 14
  messagesConsidered: number;                    // count of user messages in window
  asOf: string;                                  // ISO timestamp
}

export async function getRecentTopicSignal(
  userId: string,
  deps?: { db?: DrizzleClient; now?: () => Date }
): Promise<RecentTopicSignal>;
```

Implementation:
- Pull all `messages` rows where `role = 'user'`, joined to `conversations` filtered to `user_id = $userId`, in the last 14 days.
- For each message, take the top 1 (or up to 3) topics from `classified_topics`. Apply a recency weight: `weight = exp(-age_days / 7)` so a message from yesterday counts about 4× a message from a week ago. Sum per slug.
- Normalize so the top weight is 1.0.
- Return top 5.

Pure function over the DB read; no LLM calls.

### Tests

- Unit (`packages/rag/test/topics/classifier.test.ts`):
  - Empty input → empty output, no LLM call.
  - "How do I get her to take a shower" → `bathing-resistance` in top topic (mock the LLM to return this).
  - LLM returns a slug not in the closed set → filtered out, slug discarded, log a warn.
  - LLM throws → returns `{ topics: [], confidence: 0 }`, warn called.
- Unit (`packages/rag/test/topics/signal.test.ts`):
  - Empty history → `topTopics: []`, `messagesConsidered: 0`.
  - Three messages all tagged `sundowning` → `sundowning` is top with weight 1.
  - Recency: a `bathing-resistance` from 6 days ago plus 5× `sundowning` from 13 days ago → `bathing-resistance` wins because of the recency weight; assert the ratio.
- Integration (`packages/rag/test/topics/persistence.integration.test.ts`, gated on `TOPICS_INTEGRATION=1` + `DATABASE_URL`): call the pipeline against a real DB with a stubbed Bedrock and assert the `classified_topics` jsonb landed correctly on the row.

### Documentation

- `docs/adr/0013-topic-classifier-and-recent-signal.md` — covers (a) why a closed vocabulary, (b) why classify per turn rather than re-classifying on every signal read, (c) the recency weighting choice (why exponential, why 7-day half-life), (d) the failure mode (warn + persist empty, never block the answer).
- One-paragraph addendum to `docs/adr/0008-rag-pipeline-v0.md` pointing at the new ADR.

---

## Acceptance criteria

- `pnpm typecheck lint test` green across the monorepo.
- New migration adds the two `messages` columns; backfill is "leave existing rows at default" (`[]` / null) — no data needed.
- `runPipeline` (or the route handler) classifies the user's question into 0–3 topic slugs from the closed vocabulary and persists them.
- `getRecentTopicSignal(userId)` returns a ranked, weighted list, normalized.
- Topic classifier failure does **not** break answer generation — it logs and persists empty.
- Unit tests cover the empty-input, LLM-error, off-vocab, and recency cases above.
- ADR 0013 written; ADR 0008 updated with the pointer.
- One live-eval run (`EVAL_LIVE=1 pnpm --filter @alongside/eval start -- answers`) on a dev DB shows non-empty `classified_topics` on the seeded golden questions.

---

## Files to create / modify

### Create

```
packages/rag/src/topics/classifier.ts
packages/rag/src/topics/signal.ts
packages/rag/src/topics/prompt.ts                  # the structured-output prompt
packages/rag/src/topics/index.ts                   # re-exports
packages/rag/test/topics/classifier.test.ts
packages/rag/test/topics/signal.test.ts
packages/rag/test/topics/persistence.integration.test.ts
packages/db/migrations/0005_messages_classified_topics.sql
docs/adr/0013-topic-classifier-and-recent-signal.md
```

### Modify

```
packages/rag/src/pipeline.ts                       # parallel topic classification call + persist
packages/rag/src/deps.ts                           # add a topics-classifier dep, default-wired
packages/db/src/schema/messages.ts                 # add the two columns
docs/adr/0008-rag-pipeline-v0.md                   # short addendum
TASKS.md
```

### Do **not** touch

- The safety classifier (separate concern, separate failure mode).
- The retrieval / grounding / verification layers — topic classification feeds the picker, not the answerer in v0.
- The `topics` table itself (TASK-019 owns its shape and seeding).

---

## Out of scope

- **Using topics inside the answering pipeline** — i.e. boosting retrieval toward modules tagged with the user's recent topics. Tempting; deferred. v0 keeps retrieval as it is so we don't muddy the eval baseline. The picker is the only consumer of `getRecentTopicSignal` in this sprint.
- A re-classification pass over historical messages (sprint-1 messages will have empty `classified_topics`; the picker degrades gracefully when `messagesConsidered` is small).
- An admin view of topic distribution (out of scope; we have CloudWatch / the eval report).
- A topic vocabulary editor — adding a topic means editing `seed-topics.ts` (or the migration) and re-seeding.
- Topic classifier confidence threshold for persistence — persist whatever the model returns from the closed set.

---

## Decisions to make in the PR

- **One topic per message, or up to 3?** My vote: **up to 3**, but the signal aggregator uses only the top-1 per message (so a noisy multi-tag message doesn't flood the signal). Document.
- **Where the topic classifier lives.** It's coupled enough to RAG that it sits in `packages/rag/src/topics/`. Could justify a new `packages/topics` package; that's premature.
- **Whether to also persist the §7.1 category** (derivable from the slug via `topics.category`). My vote: **no**, derive on read. The slug is the canonical signal.

---

## Questions for PM before starting

1. The 14-day window for `getRecentTopicSignal` — sign off, or want shorter (7) or longer (30)? My vote: 14, matches the "this week" cadence with one week of memory headroom.
2. Recency half-life of 7 days — sign off? My vote: yes, with the ADR noting it's tunable.
3. Should the picker get **only** `getRecentTopicSignal` from this ticket, or also a synchronous `getCurrentMessageTopic(messageId)` (for "you just asked about X — would you like the lesson on X right now")? My vote: **both** — same surface, two thin functions. Cheap to add now.

---

## How PM verifies

1. `pnpm install`; live DB up.
2. `pnpm --filter @alongside/db migrate` — new migration applies.
3. `psql -c '\d+ messages'` — new columns present.
4. `pnpm --filter web dev`, log in, send three questions about bathing across a fresh conversation.
5. `psql -c "select content, classified_topics from messages where role='user' order by created_at desc limit 3;"` — three rows, each with `bathing-resistance` (or close) in `classified_topics`.
6. Open a node REPL: `import { getRecentTopicSignal } from '@alongside/rag'; await getRecentTopicSignal('<your user id>')` — returns `topTopics` with `bathing-resistance` at top weight 1.
7. Read ADR 0013.

---

## Report-back

- Branch + PR + acceptance checklist.
- Migration SQL inline.
- The structured-output prompt inline (so I can sanity-check the closed-vocabulary instruction).
- An example signal output from a real session you ran (paste it in the PR).
- Decisions you landed on (the three above).
