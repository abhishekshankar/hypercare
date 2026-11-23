# TASK-041 — Streaming the library search surface

- **Owner:** Cursor
- **Depends on:** TASK-023 (library screen — the surface we're modifying), TASK-031 (streaming transport — SSE parser + envelope reused), TASK-040 (the `card`-style event vocabulary established in ADR 0029 — we extend with a `result` event)
- **Unblocks:** the second part of the Sprint 4 cohort latency complaint (library search feels sluggish once the library has 30+ saves); validates the SSE transport for a non-LLM, non-pre-content surface (search results streamed as the index returns matches)
- **Status:** done (implementation landed; apply migration `0020_library_search_streams` + set flags to verify end-to-end)
- **ADR:** ADR 0029 covers both this and TASK-040. This ticket appends a "Library results" section.

---

## Why this exists

The library surface (TASK-023) ships as a client-side substring filter over the user's saved answers + recent topics + bookmarked modules. v1 worked when the library was empty or near-empty. Beta cohort feedback (TASK-036 thumbs-down + free-text) flagged two related issues once the library filled up:

1. **Cohort users with 30+ saves saw a 600–1500ms delay** on each keystroke as the surface re-filtered the full set client-side. The bottleneck is not the substring match itself — it's the layout cost of re-rendering all matched rows on each keystroke. By the time a beta user has lived in Hypercare for 4 weeks they have meaningful library state.
2. **The library doesn't yet do semantic search.** Sprint 5 plan keeps that out of scope (the picker and conversation pipeline already use embeddings; widening the library to embeddings is a Sprint 6 question). But the *mechanism* we ship here — streamed results as a server-side query progressively returns matches — sets up that future without re-architecting the client.

What we're shipping is a thin server-side search route that returns matches incrementally over SSE, with the client rendering each as it arrives. For the substring-only v1 this is mostly a perceived-latency win (first match in <100ms vs. full set in 600–1500ms). When semantic search lands later, the same envelope serves embedding-rerank results streaming back in score order.

---

## Context to read first

1. `prd.md` §6.6 (library surface — "look something up quietly" mode).
2. TASK-023's ticket and `apps/web/src/app/(authed)/app/library/` — the existing client-side filter; this becomes thin once the server route exists.
3. ADR 0029 (TASK-040) — the SSE vocabulary for non-LLM streaming; we add one new event (`result`).
4. TASK-031 / ADR 0020 — the SSE infrastructure.
5. TASK-038 (family sharing) — the library is **shared** between co-caregivers per the privacy table; the search route reads from `care_profile_members` to determine the candidate set, not just `user_id`. This ticket's read path must compose with TASK-038.

---

## What "done" looks like

### 1. Transport: SSE, one new event type

```
event: started        data: { query, candidateCount }
event: result         data: { id, kind, title, snippet, score, source }    # repeated
event: done           data: { latencyMs, resultCount }
event: error          data: { message }                                     # terminal
```

- `started` carries the (lower-cased, trimmed) query and the total candidate count being searched (saves + topics + bookmarked modules visible to the user, after applying TASK-038 membership rules).
- `result` fires per match, in score order. `kind` is `saved_answer | recent_topic | bookmarked_module`. `score` is the substring match score for v1 (later: embedding cosine for semantic search).
- `done` carries the total result count and round-trip latency.
- `error` is the terminal failure event.

No `card`, `chunk`, `citations`, or `refusal` events. Consistent with ADR 0029.

### 2. Server: streamed substring search

`apps/web/src/app/api/app/library/search/route.ts` (new):

- Reads the user's full library candidate set via the existing query helpers (saves, recent topics, bookmarked modules), composed with TASK-038 membership rules.
- Iterates candidates, computes a substring score (case-insensitive token containment + position weighting; same scoring TASK-023 does client-side today, lifted unchanged into a shared helper).
- Yields matches above a threshold in score order via an async generator.
- The route opens an SSE response, emits `started`, iterates the generator emitting `result` per match, emits `done`.

For typical library sizes (< 200 candidates), the server-side scoring is fast (single-digit ms) and the streaming benefit is in not waiting for the *render* of all results before the user sees any. For larger libraries the streaming benefit is structural — the user sees the top few results within ~100ms.

### 3. Client: incremental results render

`apps/web/src/app/(authed)/app/library/page.tsx`:

- The search input is debounced at 150ms (today it's instant; the new server round-trip needs a small debounce to avoid request-per-keystroke storms).
- On each non-empty query change after debounce, abort any in-flight search request and POST a new one with `Accept: text/event-stream`.
- Render results progressively as `result` events arrive. Each result is an existing `LibraryResultRow` component (reused from TASK-023; no new design).
- Render an inline "still searching…" affordance at the bottom of the list while the stream is open; remove on `done` or `error`.
- Empty `done` (no `result` events) renders the existing TASK-023 empty state ("no matches; try another word").
- On query clear, abort any in-flight stream; render the unsearched library view (saves + topics + bookmarks, top-N).

### 4. Feature flag

`STREAMING_LIBRARY=1` server-side; `NEXT_PUBLIC_STREAMING_LIBRARY=1` client-side. Both required. Default off; flip after a one-day soak. Independent of `STREAMING_LESSONS` and `STREAMING_ANSWERS`.

When the flag is off, the surface continues to do client-side filtering as today. The new search route returns 404 when the server-side flag is off, so the client is always the source of truth for which path is live.

### 5. Composition with TASK-038 (family sharing)

The library is shared per the §2 table in TASK-038: both members see all saved bookmarks at the profile level (saved_answer is per-user; bookmarked_module is per-profile; recent_topic is per-user). The search candidate set for a user is therefore:

- Saved answers where `user_id = currentUser.id`.
- Recent topics where `user_id = currentUser.id`.
- Bookmarked modules where `care_profile_id = currentMembership.care_profile_id`.

The search route applies the membership lookup once at the start and uses the resolved candidate set for the duration of the request. If TASK-038 hasn't merged when this ticket starts, fall back to today's per-user-only candidate set; the membership lookup is a one-line swap once TASK-038 lands.

### 6. Observability

Per stream, log:

- `library.search.started_at` (POST receipt), `library.search.first_result_at`, `library.search.done_at`.
- `query_length`, `candidate_count`, `result_count`.
- `user_id`. **No query text is logged** (privacy; library queries can be sensitive — "doctor said hospice"). Only length + counts.

`/internal/metrics` adds a "Library latency" tile next to the lesson tile from TASK-040: P50/P95 first-result latency, P50/P95 done latency.

### 7. Accessibility

- `aria-live="polite"` on the results list; new results announce as they arrive but not aggressively.
- The debounce window (150ms) is consistent with `prefers-reduced-motion` users not getting hit with rapid-fire announcements; no further special-case needed.
- Escape clears the search input and aborts the in-flight stream.

---

## Tests

- Unit (`packages/db/test/library-search-helpers.test.ts`): the substring scoring helper extracted from TASK-023 returns identical scores to the inline version it replaces.
- Unit (`packages/db/test/library-candidate-set.test.ts`): the candidate set composition correctly applies TASK-038 membership rules for owner, co-caregiver, and no-membership cases. (Skipped with a clear note if TASK-038 hasn't landed when this ticket runs.)
- Unit (`apps/web/test/lib/sse-result-events.test.ts`): the SSE parser handles `result` events; extends existing parser tests.
- Unit (`apps/web/test/library/streaming-search.test.ts`): the library page debounces queries; aborts in-flight on new query; renders results progressively; renders empty state on zero matches; renders error UI on `error`.
- Integration (`apps/web/test/api/library-search-streaming.test.ts`): a query against a seeded library returns SSE with the expected events; a query for a term not in the library returns `started` → `done` (no results); a malformed body returns 400.
- E2E (`apps/web/test/e2e/streaming-library.spec.ts`): with the flag on, type a query letter-by-letter; assert results appear within 250ms of stopping typing; assert the result set updates as expected; clear the input and confirm the unsearched library view returns. With the flag off, confirm the existing client-side filter still works.

---

## Acceptance criteria

- P50 first-result latency ≤ 200ms; P95 ≤ 500ms on the dev deployment, against a seeded library of 50 candidates (recorded in ADR 0029).
- Streaming applies only with both `STREAMING_LIBRARY` flags on. Off renders today's TASK-023 client-side filter unchanged.
- Search route applies TASK-038 membership rules (or per-user-only if TASK-038 hasn't merged; tracked as a follow-up patch in that case).
- No query text logged; counts and lengths only.
- ADR 0029 updated with the "Library results" subsection.
- `/internal/metrics` has the library latency tile.
- `pnpm lint typecheck test` green; no regression on retrieval / safety / answers eval.

---

## Out of scope

- Semantic / embedding search over the library. Substring v1 only; semantic is a Sprint 6 conversation.
- Server-side search caching. Each query is fresh; library sizes are small; caching adds complexity for a perceived-latency feature that already wins by streaming.
- Search-as-you-type predictions / suggestions. Just results.
- Multi-field highlighting in the rendered results beyond what TASK-023 already does.
- Search across other caregivers' private surfaces (their saved answers, their threads). TASK-038 privacy posture explicitly forbids this.
- A "saved searches" feature.
- A "didn't find what I needed" feedback path. The thumbs-down loop (TASK-036) is the catchall.

---

## Decisions to make in the PR

- **Debounce window.** 150ms strawman. Lower feels faster, costs requests; higher feels laggier, costs requests less. Confirm.
- **Whether to emit a separate `progress` event** for "we've scanned 50/200 candidates." Strawman: no. The score-ordered `result` stream is the user's signal; an internal progress event is noise.
- **Score threshold for emitting a `result`.** Strawman: any non-zero substring match. With <200 candidates this won't flood the client. If this surface ever scales to thousands, raise the threshold; not v1's problem.
- **Empty-query behavior.** Strawman: short-circuit on the client; never POST to the route. The route returns 400 on empty query as a defense-in-depth.

---

## Questions for PM before starting

1. **Per-surface vs. unified streaming flag.** Same question TASK-040 raises. Strawman: per-surface. Confirm.
2. **Library candidate composition under TASK-038.** Confirm the §5 mapping — saves are per-user, topics are per-user, bookmarks are per-profile. The TASK-038 ADR locks this in; this ticket inherits it.
3. **First-result latency target.** 200ms P50 strawman against a 50-candidate seed. The cohort baseline is multi-second perceived; this is a meaningful win. Confirm or relax.
4. **Whether to ship even if TASK-038 slips.** Strawman: yes; the ticket falls back to per-user-only candidates, with a follow-up patch when TASK-038 lands. Alternative: block on TASK-038 to avoid a two-step ship. Confirm.

---

## How PM verifies

1. Set both `STREAMING_LIBRARY` flags. Open `/app/library` as a cohort user with ≥ 20 saves. Type a query. First result visible within ~200ms of pause; full result set within ~500ms.
2. Repeat with the flags off. Same results, same scoring, but full set arrives in one paint after a noticeable beat.
3. Mid-search, type more letters. Confirm the in-flight request is aborted (Network tab; the request shows status `cancelled`) and a new one fires.
4. Clear the input. Confirm the unsearched library view returns and any in-flight stream is aborted.
5. With TASK-038 merged: as a co-caregiver, search a term that matches a profile-level bookmark created by the owner. Confirm it appears. Search a term that matches the owner's saved answer (per-user). Confirm it does **not** appear.
6. Check application logs for a search request — only `query_length` and counts; never the query text.
7. `/internal/metrics` shows the library latency tile with real numbers.
8. Read the ADR 0029 "Library results" subsection.
