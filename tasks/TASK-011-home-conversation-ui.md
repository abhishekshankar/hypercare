# TASK-011 — Home screen + conversation UI wired to the RAG pipeline

- **Owner:** Cursor
- **Depends on:** TASK-005 (route skeleton, CrisisStrip), TASK-006 (session), TASK-007 (care_profile for greeting), TASK-009 (`answer()`), TASK-010 (safety classifier + refusal shape)
- **Status:** in_review
- **ADR:** `docs/adr/0010-conversation-ui-v0.md`

---

## Why this exists

Up to now, every ticket has been plumbing — auth, schema, retrieval, safety. This task is the first one the user actually sees. It turns the existing `(authed)/app` route (a greeting placeholder from TASK-005 + TASK-007) into the real home screen, and lights up a `(authed)/app/conversation` flow that sends a question to `rag.answer()`, renders the response, shows citations inline, and writes the turn to `conversations` / `messages`.

This task does not add voice, streaming, starter chips beyond a minimal set, conversation history UI, or any module browse page. Those are post-v1. It does need to ship the citation UX correctly and the refusal UX correctly — both are design-critical for trust, and both are why TASKs 009 and 010 ship structured `Citation[]` and `RefusalReason` types instead of prose.

---

## Context to read first

1. `PROJECT_BRIEF.md` §7, §8.
2. `prd.md` §6 (screens — focus on §6.2 home and §6.3 conversation), §7.2 (attribution line — must be shown), §8 (grounded-over-generated manifests as citation UX), §10 (safety UI surface).
3. `apps/web/src/app/(authed)/app/page.tsx` — the current landing page (greeting from TASK-007). You're replacing its body.
4. `apps/web/src/components/CrisisStrip.tsx` (or wherever TASK-005 put it) — already rendered in the authed layout. Do not duplicate.
5. `packages/rag/src/types.ts` — `AnswerResult`, `Citation`, `RefusalReason`.
6. `packages/safety/src/types.ts` — `SafetyResult`, `SafetyCategory`, `SuggestedAction`.
7. `packages/db/src/schema/conversations.ts` and `messages.ts` — persistence targets.
8. `apps/web/src/lib/auth/session.ts` (or wherever TASK-006 put `requireSession`) — auth gate for the new Route Handlers.

---

## What "done" looks like

### Home screen (`/app`)

- Greeting preserved from TASK-007 ("Good morning, {display_name}. / Caring for {cr_first_name}.").
- Below greeting: a prominent **Ask something** entry — a single text input + submit button. On submit, POST to `/api/app/conversation/start`, which creates a `conversations` row and redirects to `/app/conversation/[id]`.
- **3 starter suggestions**, stage-aware:
  - If `inferStage(...) === "early"` or `null`: "She keeps asking the same question", "How do I talk about the diagnosis", "Do I need a power of attorney".
  - If `"middle"`: "Afternoon agitation", "Bathing resistance", "Am I burning out".
  - If `"late"`: "Bathing resistance", "How to handle non-recognition", "When to consider memory care".
- These live in a typed table, not an LLM call.
- A small "Recent conversations" list (up to 5), each link goes to `/app/conversation/[id]`. For v0 just the first user message truncated and the timestamp. No grouping.

### Conversation screen (`/app/conversation/[id]`)

- URL carries conversation id so refresh works.
- Loads existing `messages` rows for that conversation on mount, oldest first.
- Each user message rendered plainly. Each assistant message rendered with citations (see below).
- Input pinned to bottom: text area + submit. Submit POSTs to `/api/app/conversation/[id]/message`, which:
  1. Writes the user `messages` row (role=user).
  2. Calls `rag.answer({ question, userId })`.
  3. Writes the assistant `messages` row (role=assistant) with the text AND the citations array into `messages.citations` (new column — see Schema note).
  4. Returns the turn payload to the client.
- No streaming in v0 — request/response with a visible loading state. Streaming is a later task.

### Citation UX (design-critical)

- Assistant text is rendered as plain paragraphs. `[n]` citation markers in the text become small superscript chips, each clickable.
- Clicking `[n]` opens an inline expansion **under the paragraph** (not a modal) that shows:
  - The module title.
  - The section heading.
  - The attribution line from PRD §7.2 (verbatim, e.g. "Adapted from the Alzheimer's Association caregiver guide, 2024.").
  - A "Read the full module" link → `/app/modules/[slug]` (this route is a stub page in v0: "Full module browse coming soon" — real build is post-v1).
- Do **not** use tooltips on hover. Click-to-expand is accessible and mobile-friendly.

### Refusal UX (design-critical)

When `answer()` returns `{ kind: "refused", reason }`, render a dedicated card, **not** a generic error:

| `reason.code` | Copy |
|---|---|
| `no_content` | "I don't have anything for that question yet. Our content library is growing — try a different phrasing, or see Help." |
| `low_confidence` | "I'm not confident enough to answer that from what I've got. Try a more specific question, or see Help." |
| `off_topic` | "That's outside what I can help with. I'm focused on day-to-day caregiving for someone with dementia." |
| `uncitable_response` | "Something went wrong answering that. I don't want to guess — please try again." + offer "Report this" link (no-op in v0). |
| `safety_triaged` | **Distinct red/amber card**. Render the `suggestedAction` as the primary CTA: "Call 988", "Call 911", "Call Adult Protective Services". Do not render a grounded answer underneath. Also highlight the CrisisStrip (add `data-pulse="true"` to the strip for this pageview). Log an analytics event (placeholder — just `console.info` for v0). |
| `internal_error` | "Something broke on our end. Try again in a moment." |

Each refusal card carries a "See resources" link → `/help`.

### Schema note

`messages.citations` doesn't exist yet. Add a migration:

- `messages.citations jsonb NOT NULL DEFAULT '[]'::jsonb` — stores `Citation[]` for assistant messages, empty array for user messages.
- `messages.refusal jsonb` — nullable; stores `RefusalReason` when assistant refused, null when it answered.

Migration only, no other changes to `messages`.

### Server boundary

- All calls from the browser into the RAG pipeline go through Route Handlers under `app/api/app/conversation/**`. The browser **never** imports `@hypercare/rag` directly; keep Bedrock/DB off the client bundle.
- Every handler calls `requireSession()` and returns 401 if absent.
- Use `zod` to validate request bodies; return 400 with a structured error on bad input.

---

## Acceptance criteria

- `pnpm --filter web typecheck lint test` green; `pnpm --filter web build` green with webpack (TASK-006's decision stands).
- `/app` renders greeting + 3 stage-aware starter chips + recent conversations (empty state OK).
- Clicking a starter chip pre-fills the input and submits, ending at `/app/conversation/[id]`.
- Sending a grounded question (e.g. "afternoon agitation") returns an answer with at least one `[n]` chip; clicking the chip expands to show module title + section + attribution line + link to `/app/modules/[slug]`.
- Sending a crisis-signal question routes through `safety_triaged` and shows the red/amber card with the correct `suggestedAction`. The CrisisStrip pulses via `data-pulse`. No grounded answer is rendered.
- Sending an off-topic question ("capital of france") shows the off-topic refusal card. No fake answer.
- Reloading `/app/conversation/[id]` reconstructs the thread from `messages` rows.
- `messages.citations` is populated on assistant turns. `messages.refusal` is populated on refused turns.
- Playwright E2E covers: starter-chip click → answer, crisis question → triage card, off-topic → refusal card. Mock the RAG + safety layers at the module boundary for E2E (fixture `AnswerResult`s); do not hit Bedrock in CI.

---

## Files to create / modify

### Create

```
apps/web/src/app/(authed)/app/page.tsx                                 # replace body with home
apps/web/src/app/(authed)/app/conversation/[id]/page.tsx
apps/web/src/app/(authed)/app/modules/[slug]/page.tsx                  # stub "coming soon"
apps/web/src/app/api/app/conversation/start/route.ts
apps/web/src/app/api/app/conversation/[id]/message/route.ts
apps/web/src/app/api/app/conversation/[id]/route.ts                    # GET thread
apps/web/src/components/home/StarterChips.tsx
apps/web/src/components/home/RecentConversations.tsx
apps/web/src/components/conversation/ConversationThread.tsx
apps/web/src/components/conversation/Composer.tsx
apps/web/src/components/conversation/CitationChip.tsx
apps/web/src/components/conversation/CitationExpansion.tsx
apps/web/src/components/conversation/RefusalCard.tsx
apps/web/src/components/conversation/TriageCard.tsx                    # the safety variant
apps/web/src/lib/conversation/persist.ts                               # typed Drizzle writes
apps/web/src/lib/conversation/load.ts
apps/web/src/lib/conversation/starters.ts                              # stage → 3 strings
apps/web/src/lib/conversation/refusal-copy.ts                          # the table above
packages/db/migrations/NNNN_messages_citations_refusal.sql
apps/web/test/e2e/conversation.spec.ts
docs/adr/0010-conversation-ui-v0.md
```

### Modify

```
packages/db/src/schema/messages.ts                                     # add citations + refusal columns
apps/web/package.json                                                  # depend on @hypercare/rag, @hypercare/safety (type-only ok for types)
TASKS.md
```

### Do **not** touch

- The CrisisStrip component itself — you use its existing `data-pulse` hook (add one if not present; minimum additive change).
- Auth routes / middleware from TASK-006.
- `packages/rag/**` or `packages/safety/**` internals. If the type surface is insufficient, stop and flag.
- Onboarding routes.

---

## Out of scope

- Streaming token-by-token rendering. Stubbed out; add a TODO comment pointing at a future task.
- Voice input. Post-v1.
- Module browse (`/app/modules/[slug]` is a stub).
- Conversation rename / delete UI.
- Chat history search.
- Multi-turn context (each question goes to `rag.answer()` fresh in v0 — conversation memory is a known follow-up, noted in the ADR).
- Feedback thumbs / report-a-problem beyond the no-op link in the `uncitable_response` card.
- Dark mode.
- Mobile gesture polish beyond "it works on a 375px viewport."

---

## How PM verifies

1. Local dev, log in, land on `/app`. Greeting present. 3 starter chips match your stage (check by manually editing your `care_profile.stage_answers` in the DB to force each stage).
2. Click a starter — URL becomes `/app/conversation/<uuid>`, answer renders, citations clickable, expansion shows module + attribution.
3. Paste the two crisis sentences from TASK-010's acceptance criteria — triage card appears, CrisisStrip pulses, no grounded answer.
4. Paste "what is the capital of france" — off-topic refusal card.
5. Reload the conversation URL — thread reconstructs.
6. Check `messages` table — citations jsonb populated on assistant rows; refusal jsonb populated on the refused rows.
7. Read ADR 0010 — it should justify inline click-to-expand over tooltips, and no streaming in v0.

---

## Decisions already made

- Click-to-expand citations, not tooltips.
- Refusal cards are a first-class UX, not a toast or an error banner.
- Triage card is visually distinct from other refusals.
- No streaming in v0.
- Each question is a fresh `rag.answer()` call — no conversation memory threaded into retrieval in v0.
- `messages.citations` is jsonb, not a relational join to `module_chunks`. Chunks may be re-embedded later and we want the UI to render the citation as the answer had it.
- Routes under `(authed)`; everything enforced by the existing middleware.

---

## Questions for PM before starting

1. **Starter chips copy.** The 9 strings above — do you want to sign off on them first, or ship and iterate? My vote is ship + iterate.
2. **The `Report this` link on `uncitable_response`.** No-op in v0 is fine; the alternative is a tiny Route Handler that writes a feedback row. 3-hour difference. Pick.
3. **`/app/modules/[slug]` as a stub.** Confirm "coming soon" is acceptable v0 copy, or give me the one-screen design.

---

## Report-back

- File list; route tree diff.
- Screenshots of: home, grounded answer with expanded citation, off-topic refusal, triage card.
- Migration SQL.
- Playwright output for the 3 E2E flows.
- Any component that turned into a larger refactor than the ticket implied — flag.
