# TASK-040 — Streaming the lesson surface

- **Owner:** Cursor
- **Depends on:** TASK-024 (lesson surface — the rendered cards we will stream), TASK-031 (streaming transport — we reuse the SSE infrastructure and the parser, do not rebuild)
- **Unblocks:** the second-order latency complaint from the Sprint 4 cohort (the lesson card paint after picker pick); reuse of the SSE transport for non-conversation surfaces; unblocks TASK-041 (library streaming) by proving the pattern outside conversation
- **Status:** in progress
- **ADR:** `docs/adr/0029-streaming-lessons-and-library.md` (new — extends ADR 0020; covers per-card progressive paint, abort semantics, and what "stream" means when the underlying content is *not* LLM-generated)

---

## Why this exists

Sprint 4 explicitly scoped streaming to the conversation answer pipeline (TASK-031) "because that's where the latency pain is." That was right at the time. The closed-beta cohort surfaced a second-order latency complaint that's smaller per request but more frequent: the lesson surface paints in 800–2200ms after a picker pick, and during that window the user sees a spinner. Frequency matters: every `/app` load that hits "this week's focus" pays this cost; a single user pays it daily.

What's slow is not generation — lesson content is pre-rendered from `modules.body_md`, sliced into cards by TASK-024. The latency comes from:

1. The picker run (TASK-024) hits `lesson_progress`, `module_topics`, recent-conversation-topic signal — ~250ms.
2. With TASK-037 (SRS) landing this sprint, add ~50ms for the schedule pre-filter.
3. Loading the full module body and slicing into 6 cards on the server before responding — ~150ms.
4. Network transfer of the full payload (typically 30–60kB of markdown + slice metadata) — ~100ms.
5. Client render of all 6 cards in one paint — ~100ms layout + style.

Streaming flips the contract: paint card 1 in ~300ms; cards 2–6 stream in over the next ~600ms; the user starts reading immediately. This isn't an LLM-streaming case, but the SSE transport from TASK-031 maps cleanly: the server emits a `card` event per slice as it serializes, and the client appends to a card list.

Importantly, **streaming here is transport-only and pre-content.** No LLM is involved at lesson render time. We're not generating lessons on demand; we're streaming a pre-rendered slice list. ADR 0029 makes this distinction explicit so a future maintainer doesn't add a Layer-6 verifier here by analogy with TASK-031 — there's nothing to verify.

---

## Context to read first

1. `prd.md` §6.5 (lesson surface contract — 5-minute structured cards).
2. TASK-024's ticket and `apps/web/src/app/(authed)/app/lesson/[moduleId]/` — the existing lesson route, the slicer in `packages/picker/src/lesson-slicer.ts` (or wherever TASK-024 put it; rename in the PR if needed for clarity).
3. `docs/adr/0020-streaming-answers.md` — the SSE event vocabulary; we extend it with one new event type (`card`).
4. `apps/web/src/lib/sse.ts` — the parser. No changes; just reused.
5. `apps/web/src/components/conversation/AssistantTurn.tsx` — for the streaming-aware render pattern; the lesson component mirrors the structure.
6. TASK-037 (SRS, in flight this sprint) — the picker pre-filter adds latency; this ticket should not regress the (pre-streaming) baseline.

---

## What "done" looks like

### 1. Transport: SSE, extending TASK-031's vocabulary

The lesson route returns SSE with a small explicit vocabulary:

```
event: started        data: { moduleId, cardCount }
event: card           data: { index, kind, body_md }     # repeated, in order
event: done           data: { latencyMs }
event: error          data: { message }                  # terminal
```

- `started` fires once after the picker resolves and the module body is loaded but before the first card is sliced. Carries `cardCount` so the client can render skeleton placeholders for cards 2..N.
- `card` fires per slice in order: `index` is 0-based, `kind` is one of `intro | content | technique | recap | check_in` (matches TASK-024's slice taxonomy), `body_md` is the slice markdown.
- `done` is the terminal success event with total latency for telemetry.
- `error` is the terminal failure event.

No `chunk` events (those are TASK-031's token-level event for LLM generation). No `citations` event (lesson body is the citation; module ids are surfaced in the existing footer). No `refusal` event (lessons are pre-vetted content; there's nothing to refuse mid-stream).

### 2. Server: progressive serialization

`apps/web/src/app/api/app/lesson/[moduleId]/route.ts` becomes streaming-capable:

- `Accept: text/event-stream` → SSE per §1.
- `Accept: application/json` → today's one-shot payload, deprecated. Same back-compat pattern as TASK-031 §7. Removal scheduled for Sprint 6 once E2Es migrate.
- Implementation: the slicer (TASK-024) is refactored into an async generator (`sliceModuleBody(body_md): AsyncIterable<Card>`). The route handler awaits picker → opens an SSE response → emits `started` → iterates the slicer, emitting `card` per yielded slice → emits `done`.
- The slicer is **synchronous CPU work**; the "stream" exists to interleave the network transfer with the slicing, not to wait for content. In practice the cards emit within milliseconds of each other on the server; the perceived progressive paint comes from the client rendering each as it arrives, not from server-side delay.
- For very long modules (≥ 10kB body), the slicer naturally takes longer per card; this is where streaming actually helps. For short modules the user sees a near-instant fully-rendered surface anyway — streaming costs nothing in that case.

### 3. Client: progressive card render

`apps/web/src/app/(authed)/app/lesson/[moduleId]/page.tsx` (or its child component) gains a streaming variant:

- On mount, `fetch` with `Accept: text/event-stream`; parse with the existing `apps/web/src/lib/sse.ts` helper.
- On `started`: render `cardCount` skeleton placeholders (matches the existing TASK-024 skeleton style; no new design tokens).
- On each `card`: replace the skeleton at `index` with the rendered markdown card.
- On `done`: enable navigation controls (next-card pager, "mark complete," "revisit" toggle from TASK-037).
- On `error`: show a kind "this lesson didn't load — try again" with a retry that re-fetches.

The first card paints as soon as it arrives, before subsequent cards stream in. The user can start reading card 1 immediately.

**Aborting:** if the user navigates away mid-stream (back button, route change), the fetch is aborted via `AbortController`; the server's response stream closes; no partial `lesson_progress` row is written (lesson_started fires only on first user-visible interaction with card 1 — clicking pager, scrolling past, etc., as today).

### 4. Feature flag

`STREAMING_LESSONS=1` server-side env var; `NEXT_PUBLIC_STREAMING_LESSONS=1` client-side. Both required to be on for the streaming path to engage; otherwise the existing one-shot path renders unchanged. Default off; flip via Parameter Store after a one-day soak in dev.

The flag is independent of `STREAMING_ANSWERS` (TASK-031) and `STREAMING_LIBRARY` (TASK-041). Sprint 4 quality-gates wanted per-surface rollback; we keep that posture.

### 5. Accessibility

- Streaming cards announce via `aria-live="polite"` on the lesson container. Same rule as TASK-031: never `assertive`.
- `prefers-reduced-motion`: skeletons render statically (no shimmer); cards appear without slide-in animation.
- Keyboard: pressing Escape mid-stream cancels (matches TASK-031). The user is returned to `/app` with a small toast: "Lesson cancelled."

### 6. Observability

Per stream, log:

- `lesson.stream.started_at` (POST receipt)
- `lesson.stream.first_card_at` (ms from started)
- `lesson.stream.done_at` (ms from started)
- `module_id`, `card_count`, `user_id`
- The picker latency and SRS pre-filter latency (TASK-037) as separate fields so we can see the full critical path.

`/internal/metrics` (TASK-029) gains a "Lesson surface latency" tile: P50 / P95 first-card latency, P50 / P95 done latency. Same pattern as TASK-031 added for conversation streaming.

### 7. Telemetry: no quality regression

Streaming changes the *transport*, not the *content*. The existing lesson-completion rate, "marked revisit" rate, and (post-TASK-037) SRS bucket distributions should be unchanged. Sprint 5 quality gate explicitly checks that the answers eval and lesson completion rates don't move between flag-off and flag-on.

---

## Tests

- Unit (`packages/picker/test/lesson-slicer-async.test.ts`): the async generator yields the same cards in the same order as the existing synchronous slicer. Property test: for any `body_md`, `[...sliceModuleBody(body_md)]` equals the legacy slicer output.
- Unit (`apps/web/test/lib/sse-card-events.test.ts`): the parser handles `card` events the same as `chunk` events from TASK-031 — extends existing parser tests, doesn't rewrite them.
- Unit (`apps/web/test/lesson/streaming-render.test.ts`): the lesson component renders skeletons on `started`, replaces them on `card`, enables nav on `done`, swaps to error UI on `error`.
- Integration (`apps/web/test/api/lesson-streaming.test.ts`): a normal lesson load returns SSE with `started` → N × `card` (in order) → `done`. The JSON `Accept` header path returns the legacy one-shot response. Aborting mid-stream closes the response cleanly without writing `lesson_progress`.
- E2E (`apps/web/test/e2e/streaming-lesson.spec.ts`): with `STREAMING_LESSONS=1`, open `/app/lesson/<seeded-module-id>`; assert at least one card is in the DOM within 600ms of nav start; assert the full card set is in the DOM within 1500ms; assert the page is interactive after the last card. With the flag off, assert the page renders the same content in one paint.
- Smoke (`apps/web/test/e2e/streaming-lesson-abort.spec.ts`): start a lesson load; navigate away mid-stream; assert no `lesson_progress` row is created.

---

## Acceptance criteria

- P50 first-card latency ≤ 400ms on the dev deployment; P95 ≤ 800ms (recorded in ADR 0029).
- Streaming applies only when both `STREAMING_LESSONS=1` server and `NEXT_PUBLIC_STREAMING_LESSONS=1` client are set. Off renders identically to today (TASK-024 path).
- `Accept: application/json` still returns the one-shot response for back-compat; deprecation note in code; removal scheduled for Sprint 6.
- The slicer refactor preserves output equivalence — TASK-024's tests pass against the new async generator unchanged.
- ADR 0029 written.
- `/internal/metrics` shows the lesson surface latency tile.
- `pnpm lint typecheck test` green; answers + safety + retrieval eval don't regress.

---

## Out of scope

- LLM-generated lessons. Lessons remain pre-authored markdown; this ticket streams the pre-existing content's slices.
- Per-card LLM verification. There's no Layer 6 here. ADR 0029 says so explicitly.
- Streaming the module list (e.g. on a "browse all lessons" page). Out of scope; TASK-024's lesson surface is the only consumer in v1.
- Per-card analytics events ("user finished card 3"). Lesson completion (whole-lesson) remains the primary signal; per-card scroll-tracking is a Sprint 6+ conversation if at all.
- Server-pushed updates after the lesson loads (re-streaming on content edit). The lesson is loaded once per visit.
- A streaming render for the SRS "due for a quick review" hint (TASK-037). That's a one-line static piece of UI; rendered with the first card.
- Image streaming. Lessons may include images; they load via standard `<img>` tags as today, browser-cached.

---

## Decisions to make in the PR

- **Whether `started` carries `cardCount`** or whether the client renders skeletons on demand (one-per-card-as-it-streams, no upfront count). Strawman: include `cardCount`; it makes the perceived load smoother and costs one additional pre-emit slicer pass to count. ADR 0029 records.
- **Skeleton vs. spinner.** Skeleton (matching TASK-024's loading state) is the strawman; consistent with the rest of the app.
- **Whether to emit `card` with raw markdown** or pre-rendered HTML. Strawman: raw markdown, render client-side with the existing markdown component. Keeps the server fast; the client already has the renderer warm.
- **Abort persistence semantics.** Strawman: no `lesson_progress` row is written until the user interacts with card 1 (today's behavior). Streaming doesn't change this; just confirming.

---

## Questions for PM before starting

1. **One flag or two for streaming surfaces.** Sprint 5 plan calls for two (this + TASK-041's `STREAMING_LIBRARY`). Confirm; the alternative is a single `STREAMING_NON_CONVERSATION=1` master flag that's coarser to roll back.
2. **First-card latency target.** 400ms P50 strawman. The TASK-024 baseline is ~800ms total; halving to first paint is the headline. Confirm or relax.
3. **Skeleton design.** Reuse TASK-024's existing skeleton; if PM wants a card-shaped placeholder vs. a generic block, say so.
4. **What happens if the picker fails mid-load.** Strawman: emit `error` and the client shows a "couldn't load this — try again" with a retry that re-runs the picker. Same as today's failure UX, just inside the SSE envelope.

---

## How PM verifies

1. Set both `STREAMING_LESSONS` flags locally. Open `/app` as a beta cohort user; click into "this week's focus." First card visible within 400–600ms of click; remaining cards stream in over the next ~600ms.
2. Repeat with the flags off. Same content renders in one paint after a longer wait.
3. Mid-stream, click the back button. Confirm no `lesson_progress` row is created (`select * from lesson_progress where user_id = ... and module_id = ... order by id desc limit 1`).
4. Open dev tools Network tab, inspect the response — content type is `text/event-stream`; events are visible in order.
5. `curl -H "Accept: application/json" .../api/app/lesson/<module-id>` returns the one-shot JSON (back-compat).
6. `/internal/metrics` shows the lesson latency tile with real numbers after a few requests.
7. Read ADR 0029.
