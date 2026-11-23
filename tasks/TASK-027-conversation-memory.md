# TASK-027 — Conversation memory: rolling caregiver-state summary threaded into retrieval

- **Owner:** Cursor
- **Depends on:** TASK-009 (RAG pipeline + Layer 5 prompt composition), TASK-019 (care profile change-log), TASK-022 (topic signal — orthogonal but the memory reads the same messages table)
- **Unblocks:** beta launch (returning users without memory re-state context every turn, which makes the product feel dumb on turn 2 and churns them), and feeds richer signal into the lesson picker indirectly
- **Status:** in_review
- **ADR:** `docs/adr/0017-conversation-memory.md` (new — summary shape, refresh policy, invalidation, token budget)

---

## Why this exists

Today (post sprint 2), every call to `rag.answer()` is stateless except for the care profile and the retrieved chunks. The care profile is long-lived (months), retrieval chunks are from the source library. **Nothing in the prompt reflects the user's current conversation.** So:

- Turn 1: "Margaret is pacing at 4pm every day and won't sit down."
- Turn 2: "What about at night?"

Turn 2 reaches the pipeline with no memory of turn 1. The retrieval query is "What about at night?" — which is too generic to pull the right chunks, and the generation loses the Margaret / sundowning / 4pm anchoring. The answer is either generic ("sleep problems in dementia…") or — worse — the model improvises the anchoring, which violates the grounded-beats-generated principle.

The fix is **not** to stuff the full conversation history into the prompt. That's a tokens-and-noise problem at scale and a privacy problem in operator logs. The fix is a **rolling, bounded, structured summary** of the caregiver's current situation that sits next to the care profile in Layer 5 prompt composition.

---

## Context to read first

1. `prd.md` §5.6 (profile evolution — the conversation memory is a lighter-weight cousin of this; they must not fight), §9.2 Layer 5 (prompt composition — the structured-summary pattern is where this slots in), §9.2 intro ("semantic retrieval but the right answer is personalized" — memory is part of the personalization argument).
2. `packages/rag/src/pipeline.ts` — Layer 5 is where the prompt is built today.
3. `packages/db/src/schema/messages.ts`, `conversations.ts` — the persistence substrate.
4. `packages/db/src/schema/care-profile.ts` and the change-log table (from TASK-019) — the invalidation trigger.
5. `docs/adr/0008-rag-pipeline-v0.md` §5 (Layer 5) — extend that design, don't rewrite it.
6. `docs/adr/0012-schema-v1-retention-loop.md` — how change-log events land.

---

## What "done" looks like

### 1. Schema: `conversation_memory`

New table:

```
conversation_memory
  conversation_id uuid primary key references conversations(id)
  user_id uuid not null references users(id)
  summary_md text not null           -- ≤ 400 tokens, see below
  summary_tokens int not null        -- exact token count at refresh time
  last_refreshed_at timestamptz not null default now()
  refresh_count int not null default 0
  invalidated boolean not null default false   -- true after a care-profile change-log write
  source_message_ids uuid[] not null           -- which messages were summarized
```

One row per conversation (not per user). Long-lived conversations accumulate more `refresh_count`; a new conversation starts fresh.

Migration added to `packages/db/migrations/` with standard schema-v1 patterns. `docs/schema-v1.md` extended.

### 2. Summary shape

The summary is **structured markdown**, not freeform prose. This keeps it debuggable in logs, boundable in tokens, and easy to suppress if a field is sensitive. Shape:

```md
## Current focus
- {{1-2 sentences about what the caregiver has been asking this conversation about, naming the CR}}

## What's been tried
- {{bullets of techniques mentioned or suggested earlier in the conversation; max 4}}

## Open threads
- {{bullets of follow-ups the user flagged but didn't close; max 3}}

## Signals the model should carry forward
- {{bullets of stable, anchoring facts from the conversation: behavior timing, triggers, named family members, specific situations; max 5}}
```

Total budget: **≤ 400 tokens**. Enforced at write time; if the generator overflows, it retries with a tighter instruction. Longer summaries lose their point.

The summary never contains:

- Full verbatim quotes longer than 1 sentence (privacy + noise).
- Any medication name or dose.
- Any diagnosis claim.
- Any escalation signal that already lives in `safety_flags` (it is not the summary's job to re-log crises).

A post-generation verifier regex (same shape as Layer 6 in the main pipeline) enforces the medication and diagnosis bans. Failure → retry once, then fall back to the **previous** summary (stale is safer than wrong).

### 3. Refresh policy

- **On every N-th user turn, refresh.** N = 3. (Tunable in `packages/rag/src/config.ts`.)
- **On turn 1 of a conversation:** no memory yet; Layer 5 uses profile-only (today's behavior).
- **On turn 2:** still no memory (not worth the call).
- **On turn 3:** first refresh. Reads the last 6 messages (3 user + 3 assistant).
- **On turn 6, 9, 12, …** refresh again.
- **On any care-profile change-log write** for the user: mark `invalidated = true` on all their open conversations' memory rows. The next turn triggers a refresh regardless of the N-counter.
- Refresh calls **Haiku** (not Opus/Sonnet). Cost envelope matters — this runs as often as the classifier.

Refresh prompt lives at `packages/rag/src/memory/prompt.md`, checked in, PM-reviewable. Structured output (the four headings above) enforced.

### 4. Layer 5 integration

`packages/rag/src/pipeline.ts` Layer 5 currently composes: system → care profile summary → retrieved chunks → scaffold → user query.

Update to: system → care profile summary → **conversation memory (if present and not invalidated)** → retrieved chunks → scaffold → user query.

Memory slot sits **between** profile and retrieval because it modifies how retrieval should be read but is not itself a grounded source. It renders with a visible marker in the prompt: `## What we've been discussing in this conversation` so the generator treats it as context, not as retrieval truth. Ungrounded claims traced to memory content are still Layer 6 violations — the memory is context, not citation.

Retrieval (Layer 3) **may** rewrite the query using the memory if it's present: a new `rewriteQueryWithMemory(query, memory): string` step that expands "What about at night?" into "Dementia sundowning at night with pacing, continuing from earlier conversation." Small call, Haiku. Disabled behind a flag for v0 — ship the prompt-composition integration first, query-rewrite on the memory follow-up if retrieval quality analysis shows it matters.

### 5. Observability

- Every refresh logs: `{conversation_id, user_id, summary_tokens, refresh_count, latency_ms, source_message_count}`.
- A log line per answer indicates which fields of memory were present/absent (`has_current_focus: true, has_what_tried: false, …`). This is the leakage-detection hook — if a summary consistently has "Signals" entries that look like PII leaks (addresses, phone numbers, diagnoses), we see it in the aggregate.
- A debug surface at `/internal/conversation/[id]/memory` (admin-only, same gate as the metrics surface in TASK-029) renders the current memory for a conversation. This is how PM audits during beta.

### 6. Privacy and retention

- Memory is **deleted** when the conversation is deleted (FK cascade).
- Memory is **regenerated**, not mutated — each refresh overwrites `summary_md`. No audit log of past summaries in v0 (add a `conversation_memory_history` table post-beta if needed).
- The summary is **not** exposed to the user in v0. ADR 0017 records this: we want to stabilize the content before adding a "what the product remembers from our conversation" transparency surface. (Sprint 4-5 work — mirrors the care-profile transparency surface from Screen 7.)

---

## API / code changes

```
packages/rag/src/memory/refresh.ts      # the refresh function
packages/rag/src/memory/load.ts         # conversation -> memory row -> prompt fragment
packages/rag/src/memory/types.ts
packages/rag/src/memory/prompt.md
packages/rag/src/pipeline.ts            # Layer 5 integration + post-turn refresh trigger
packages/rag/src/config.ts              # MEMORY_REFRESH_EVERY_N = 3, MAX_MEMORY_TOKENS = 400
packages/db/src/schema/conversation-memory.ts
packages/db/migrations/0011_conversation_memory.sql
packages/db/src/schema/care-profile-change-log.ts   # add trigger hook that marks memory invalidated
apps/web/src/app/api/app/conversation/[id]/message/route.ts   # existing route calls the refresh hook after persist
apps/web/src/app/internal/conversation/[id]/memory/page.tsx   # admin audit surface
docs/adr/0017-conversation-memory.md
```

Keep the refresh **async-after-reply** in the route handler: the user's answer returns immediately; the refresh fires in a `waitUntil`-style call (Next.js's `after()` or a simple fire-and-forget with error logging). This keeps perceived latency flat.

---

## Tests

- Unit (`packages/rag/test/memory/refresh.test.ts`):
  - N=3: turn 1, 2 → no call; turn 3, 6, 9 → calls.
  - After an invalidation, turn 4 calls even though 4 % 3 != 0.
  - Summary over 400 tokens triggers one retry; second overflow falls back to prior summary.
  - Banned-content regex catches "Give her more donepezil" → reject; fall back.
- Unit (`packages/rag/test/memory/layer5.test.ts`):
  - Memory absent → prompt shape matches today's.
  - Memory present → memory fragment appears between profile and retrieval.
  - Memory invalidated → pipeline treats as absent until refresh.
- Integration (`apps/web/test/api/conversation-memory.test.ts`):
  - 3-turn conversation about sundowning. Assert: after turn 3, `conversation_memory` row exists with "sundowning" in `summary_md.Current focus`. Turn 4 response prompt (captured via log) contains the memory block.
  - Care profile edit (change-log write) → next turn's response prompt has no stale memory; memory row has `invalidated = true` then gets refreshed.
- Live eval (`EVAL_LIVE=1 pnpm --filter @alongside/eval start -- answers` with the new `conversation_memory` scenario file): the `answers` mode gains a multi-turn conversation scenario; pass criterion = the turn-2 answer references turn-1 context (scored by keyword presence + a spot-check assertion that the refusal path did not fire).

---

## Acceptance criteria

- `conversation_memory` table shipped, migration runs clean, documented in `docs/schema-v1.md`.
- Memory refresh fires at N=3 with fallback-on-overflow semantics; runs async after reply; never increases user-perceived latency (asserted via a before/after P50 latency reading in `docs/adr/0017-conversation-memory.md`).
- Layer 5 prompt includes the memory fragment when present; does not include it when invalidated or absent.
- Change-log write marks memory invalidated within 5 seconds (async OK; not synchronous).
- Banned-content checks: no medication names or doses, no diagnostic claims, no long verbatim quotes.
- `/internal/conversation/[id]/memory` audit surface exists, admin-gated.
- PRD §9 grounding discipline preserved: memory is **context**, not a citation; ungrounded factual claims attributed to memory still fail Layer 6.
- The sprint-3 demo step (two-turn sundowning → "what about at night?") returns an answer that references the earlier sundowning discussion without the user re-stating it.
- ADR 0017 written; `pnpm lint typecheck test` green; answers-eval doesn't regress; new multi-turn scenario passes.

---

## Out of scope

- Cross-conversation memory (memory that leaks from conversation A into conversation B for the same user). Explicitly not shipped; the care-profile + change-log is the long-lived surface.
- Summary that quotes user verbatim sentences. The summary is paraphrased and structured.
- Query rewriting with memory (see §4 above). Shipped behind a flag, default off.
- A user-facing "what the product remembers" surface. Sprint 4+.
- Vectorizing the memory for retrieval. Memory is injected into the prompt; it is not stored in pgvector.
- Summarizing assistant turns verbatim into memory (e.g. "the assistant previously suggested X"). The summary is **about the caregiver's situation**, not about the model's output. Keeps the memory stable across model/ prompt changes.
- Streaming the refresh call. Fire-and-forget is fine; streaming would add complexity and buy nothing.

---

## Decisions to make in the PR

- **N=3 refresh cadence.** Sign off on 3, or want a time-based cadence (every 10 minutes) as well? My vote: turn-count only in v0.
- **Banned-content enforcement.** Regex list plus an LLM-judge pass, or regex only? My vote: regex only in v0 — the summary is already short and structured; an LLM judge is a future investment.
- **Token budget 400.** Sign off. Rationale in ADR: 400 tokens is large enough to carry 3-4 anchoring facts + open threads, small enough to keep Layer 5 under 4K total context.
- **Where invalidation fires.** Trigger (DB) or app-code hook? My vote: app-code hook in the change-log write path — it's observable in logs and we don't need a pg trigger.

---

## Questions for PM before starting

1. **Do we log the summary text itself, or only token counts, in CloudWatch?** PRD §9.4 says "log every LLM call" which argues for full logging; privacy argues for counts only. My vote: log text in CloudWatch but in a log group with a 30-day retention and restricted IAM. ADR 0017 records the decision.
2. **Does memory get included in the red-team harness (TASK-026)?** The 100 queries are single-turn; memory doesn't matter for them. But a future multi-turn red-team matters — flagging this as a TASK-026 follow-up.
3. **How to test invalidation in E2E without flaky timing.** Use a direct DB poke or a synthetic change-log write with a wait; document either way in the test.
4. **Should the admin audit surface render redactions** (mask names that appear in the summary)? My vote: no — the admin surface exists for debugging and PM + clinician review will be doing it; it's internal. Revisit if a non-admin role ever gets access.

---

## How PM verifies

1. `/app` — start a new conversation. Send: "Margaret has been pacing every afternoon around 4 and she won't sit down."
2. Send a generic follow-up: "Does she need more sleep?" Expect the answer to reference sundowning / afternoon pacing without you restating.
3. `psql -c "select refresh_count, summary_tokens, substr(summary_md, 1, 400) from conversation_memory where conversation_id = '…';"` — see the structured summary.
4. Visit `/internal/conversation/<id>/memory` — see the rendered summary.
5. Open `/app/profile`, change "Where does Margaret live?" to "memory care." Save.
6. Send a next-turn message. Expect `conversation_memory.invalidated` momentarily true, then refreshed. The answer prompt (visible in debug logs) reflects the new profile.
7. Eval: `EVAL_LIVE=1 pnpm --filter @alongside/eval start -- answers --scenarios multiturn-memory` — passes.
8. Read ADR 0017.
