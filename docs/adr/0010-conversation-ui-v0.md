# ADR 0010 — Home + Conversation UI v0 (TASK-011)

## Status

Accepted (Sprint 1 vertical slice).

## Context

TASK-011 is the first piece of UI a real user sees. It binds the previously-built plumbing — auth (TASK-006), care profile (TASK-007), RAG pipeline (TASK-009), safety classifier (TASK-010) — to a chat surface. The product premise (PRD §6, §7, §8, §10) makes three things load-bearing for the conversation UX even at v0:

1. **Citations are how users decide whether to trust an answer.** PRD §8 ("Grounded over generated") specifies that the source attribution is part of the answer, not a footnote. The UX has to make the source visible without breaking the reading flow.
2. **Refusals are first-class outcomes**, not error states. PRD §9.3 enumerates the refusal codes; PRD §10 specifies that a crisis-classified message must route to a real-help CTA, not an answer. Generic `"Sorry, something went wrong"` toasts would fail the product brief.
3. **Latency is visible to the user.** The pipeline runs Bedrock embeddings + retrieval + Bedrock generation + post-gen verification. Even the cheapest path is single-digit-second territory. A blank screen during that wait reads as a failure.

This ADR captures the design choices that the ticket text alone doesn't fully justify.

## Decisions

### 1. Click-to-expand citations, not tooltips

Each `[n]` citation in the assistant text is a small chip. Clicking opens an inline expansion **directly under the paragraph** showing the module heading, section heading, attribution line, and a "Read the full module →" link.

We considered three alternatives:

- **Hover tooltip** — fast on desktop, useless on mobile (no hover), and inaccessible (disappears on focus loss). Rejected.
- **Modal / drawer** — gives lots of room, but breaks the read-and-decide flow ("did this paragraph cite a real source?" is a quick check, not a context switch). Rejected.
- **Always-expanded sources block at the bottom** — answers PRD §8's "show the source", but loses the per-claim mapping that the layer-6 verifier already enforces. The model writes `[1]`, `[2]` so the user can see *which* claim came from *which* source. A bottom block dilutes that. Rejected.

Inline click-to-expand keeps the per-claim mapping, works on mobile, is screen-reader-friendly (`aria-controls` + `aria-expanded`), and doesn't steal the page. The expansion is a `<div role="region">` so it announces as a landmark on toggle.

### 2. Renumber `[n]` markers on render to match the citation slot

Layer-6 (`packages/rag/src/layers/6-verify.ts`) builds the structured `Citation[]` in *first-cited order*, deduplicated. The `n` in the model's `[n]` is a **source index** (1..len(sources)), not a position in the dedup'd `Citation[]`. If we rendered the markers verbatim, the user would see e.g. `[3] [7]` with two chips below — confusing.

`apps/web/src/lib/conversation/render-citations.ts` walks the text once to lock in the mapping (mirroring layer-6's logic exactly), then renders each marker as a sequential `[1] [2] ...` clickable chip. Clicking chip *k* opens `citations[k-1]`. The mapping math is duplicated across the boundary; the alternative (extending the `Citation` type with the original source index) was rejected because the public RAG type would carry an internal verification detail with no other consumer.

### 3. Refusal cards are a first-class component, not a toast

The `RefusalCard` is a labeled `<div role="region">` with a heading per code, copy from `lib/conversation/refusal-copy.ts`, a "See resources" link to `/help`, and (for `uncitable_response`) a no-op "Report this" button. Each code has its own heading + body so users can distinguish "I don't know that" from "I broke." The strings live in one TypeScript table, not scattered in JSX, so PM can review them in one diff.

`safety_triaged` is **not** rendered by `RefusalCard` — calling it with a triage refusal throws. The dedicated `TriageCard` component is its own file because the visual treatment (red border, larger CTA, no fallback body) and behavior (CrisisStrip pulse, analytics event) diverge from generic refusals. Routing the two through one component would force conditional CSS that's brittle and easy to regress.

### 4. CrisisStrip pulse via a global event, not Context

The persistent `<CrisisStrip />` lives in the *root* (server) layout — wrapping it in a Provider would force the entire app tree into a client component. We use a tiny pub-sub (`components/crisis-strip-pulse.tsx`) with a ref-counted module-global so:

- The latest assistant turn is the one that may drive the strip; a historical `TriageCard` in the thread does not re-pulse after a non-triaged follow-up. Ref-counting still coalesces if multiple active registrations ever apply.
- The CrisisStrip subscribes via `useState` + `addEventListener`; no Provider required.
- The strip itself becomes a client component — a one-line additive change consistent with the ticket's "minimum additive change" guidance.

`data-pulse="true"` is the public hook the ticket asks for; the CSS treatment lives on the strip itself so the pulse appearance is centralised.

### 5. No streaming in v0

PRD §6.4 doesn't require streaming, and TASK-011 explicitly defers it. The assistant turn is a single request/response with a "Thinking…" placeholder rendered between user-bubble and final answer. A `// TODO(streaming):` comment in `Composer.tsx` flags the upgrade point so a future ticket can swap the placeholder for a token stream without restructuring the thread. Server Action + streaming is the most likely implementation path.

### 6. No conversation memory threaded into RAG in v0

Each user message goes to `rag.answer({ question, userId })` fresh — no prior turns are concatenated, summarised, or otherwise fed back into retrieval. This is the ticket's stated v0 stance and it has two side-benefits:

- Retrieval quality is reproducible per-question, which makes the eval harness (TASK-012) possible.
- Layer-0 safety classification runs on the *latest* user message text only; we don't have to reason about a crisis signal that appears mid-thread but not in the current turn.

Multi-turn memory is a known follow-up; the route handler signature already takes a `conversationId` so we can read prior turns when we add it.

### 7. `messages.citations` is jsonb, not a join

PRD §8 wants the user to see the source as it was when the answer was generated. `module_chunks` may be re-embedded or replaced as the content library grows; if the citation pointed at a chunk by id and that chunk's heading later changed, the historical answer's chip would render with the new text — at best confusing, at worst defamatory. Jsonb stores the citation verbatim. This is a deliberate denormalization, captured here so a future "make this a join for storage savings" PR is rejected.

`messages.refusal` is similarly jsonb and nullable; non-assistant rows have `null`, assistant rows have either a populated `refusal` (and empty `citations`) or an empty `refusal` (and any number of `citations`). The `responseKind` column from TASK-004 carries the discriminator (`"answer"` vs `"refusal"`).

### 8. Server boundary is exactly three Route Handlers

```
POST   /api/app/conversation/start                  → create row, return id
POST   /api/app/conversation/[id]/message           → persist turn, call rag.answer
GET    /api/app/conversation/[id]                   → reload thread (currently used only by tests)
```

The browser never imports `@hypercare/rag` or `@hypercare/safety`. `lib/conversation/answer-client.ts` is the only file that touches `rag.answer()` and is `server-only`. Bedrock + DB stay off the client bundle. Every handler validates with zod and returns 401 if the session cookie is absent.

### 9. RAG mock for E2E, scoped to NODE_ENV=test

`lib/conversation/answer-client.ts` exposes a `__setRagOverrideForTests` hatch that is a strict no-op outside `NODE_ENV=test`. The Playwright spec POSTs `/api/test/conversation-mock` (existing pattern from TASK-006's `e2e-session` route, gated on `E2E_SETUP_SECRET`) which installs three deterministic responses — answered, off_topic, safety_triaged — keyed by question text. CI does not need Bedrock; live smoke remains a manual operator activity.

The override is process-global rather than per-request to keep the seam at the module boundary the ticket asked for. The Next.js test web server is single-process, so process-global is safe.

### 10. Recent conversations is a flat 5-item list, no grouping

Sprint-1 home shows up to 5 most-recent conversations as a flat list (first user message + `relativeTime`). Grouping ("today", "this week"), search, rename, delete, and pinning are out of scope. The component is a server-rendered `<section>` with `data-testid="recent-conversations"` so a future redesign doesn't bleed into the rest of the home layout.

## Consequences

- Adding `messages.citations` and `messages.refusal` is a non-destructive ALTER (jsonb default `'[]'::jsonb` and nullable jsonb respectively). Existing rows from earlier sprints — if any — cleanly default to empty.
- The chat UI is now on the user's critical path for **every** answered turn. p50 latency is dominated by Bedrock generation (~2–4s per the answerer), then verification (sync). The "Thinking…" placeholder is what stands between this feeling like a working product and a hung one.
- A failure in `persistTurn` after the user message inserts but before the assistant message inserts leaves an orphaned user row. Acceptable at v0 — the next reload still shows the question without the answer; we surface a friendly retry. A transactional wrapper is a follow-up.
- The `_a11y_` story for the inline citation expansion uses `aria-controls` + `aria-expanded` and a single open-at-a-time toggle per paragraph. Multiple paragraphs can have one expansion open simultaneously; this is intentional — two open expansions don't fight for layout because each lives directly beneath its own paragraph.

## References

- `tasks/TASK-011-home-conversation-ui.md`
- ADR 0008 — RAG pipeline v0
- ADR 0009 — Safety classifier v0
- PRD §6.2 (home), §6.3 (conversation), §7.2 (attribution line), §8 (grounded over generated), §10 (safety UI surface)
- `apps/web/src/components/conversation/*`
- `apps/web/src/app/api/app/conversation/**`
- `packages/db/migrations/0002_messages_citations_refusal.sql`

## Known issues (local dev)

- **Canonical-origin redirect + Playwright (resolved in TASK-013):** `playwright.config.ts` sets `PLAYWRIGHT_TEST_BASE_URL` for the dev server; `canonicalLoopbackRedirectUrl` no-ops the dev-only loopback bounce when that var is set (and never in production). See `tasks/TASK-013-playwright-canonical-redirect.md`.
