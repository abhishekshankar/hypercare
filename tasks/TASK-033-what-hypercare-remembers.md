# TASK-033 — "What Hypercare remembers about you" transparency surface

- **Owner:** Cursor
- **Depends on:** TASK-020 (editable care profile UI — this ticket extends it), TASK-027 (conversation memory — the mirror surface this ticket exposes)
- **Unblocks:** user trust at scale; PRD §5.6 transparency promise; a future v2 feature where the memory feeds retrieval visibly
- **Status:** pending
- **ADR:** `docs/adr/0022-transparency-surface.md` (new — what we expose, what we hide, "forget this" semantics per field)

---

## Why this exists

PRD §6.7 says the care-profile screen doubles as *"the transparency layer — caregivers can see and control what the AI is using to personalize, which matters for trust."* TASK-020 shipped the care-profile half of this. TASK-027 introduced the conversation memory — deliberately not user-visible in v0 — and its ADR (0017) explicitly names the transparency mirror as sprint-4+ work. This is that work.

The product promise is that the caregiver can see, in plain English, **everything the AI is drawing from about their situation** for any answer it gives. That's two data sources post-sprint-3:

1. The care profile — rows in `care_profile` + the change-log — the long-lived stuff.
2. The conversation memory — the rolling summary in `conversation_memory` — the current-conversation stuff.

Bonus (recommended to include, not essential): the current conversation's retrieval citations render per-message on the thread already (source-attribution footer). The transparency surface lists *which modules have been cited to this user* in the last 30 days so the caregiver sees the shape of what the product has been telling them.

---

## Context to read first

1. `prd.md` §6.7 (transparency promise), §5.6 (profile evolution over time — the change-log is a transparency artifact).
2. `docs/adr/0017-conversation-memory.md` — the memory summary shape. This ticket renders that shape.
3. `apps/web/src/app/(authed)/app/profile/page.tsx` — TASK-020's surface. This ticket adds a new section to it.
4. `packages/db/src/schema/conversation-memory.ts` — the read side.
5. `packages/db/src/schema/care-profile-change-log.ts` (or wherever TASK-019 put it) — the history.

---

## What "done" looks like

### 1. `/app/profile` gets three new sections

Already on the page: the 5-section care-profile editor (from TASK-020). Add below it:

#### Section 6 — What Hypercare remembers from our conversations

- If there's no `conversation_memory` row yet (no conversation reached turn 3): "We don't have any conversation memory yet. Once you've been chatting for a few turns, a summary of what we're discussing will appear here."
- If there's a memory row for the user's most-recent conversation: render the structured summary (Current focus / What's been tried / Open threads / Signals) as markdown, with each bullet tappable.
- Below: "This memory is used to make your next answer feel like it's continuing the conversation. It never leaves your account." (copy, PM + legal review with TASK-032.)
- Per-bullet "Forget this" affordance (X icon). On tap: marks that bullet as forgotten; next refresh removes it from the summary.
- A "Refresh memory now" button that immediately reruns the refresh (calls Haiku, returns the updated summary).
- A "Clear memory for this conversation" button that nulls the `summary_md`, sets `invalidated = true`, and resets `source_message_ids`.

If the user has multiple active conversations, show a small conversation picker above this section defaulting to the most-recent conversation.

#### Section 7 — What we've cited to you recently

- Read: for the last 30 days, all assistant messages for the user with non-empty `citations`, distinct by module.
- Render: a list of module titles, each showing (a) how many times it was cited in a conversation with the user, (b) a "see" link that takes the user to `/app/modules/<slug>`, and (c) a timestamp of the most recent citation.
- Purpose: "You've asked a lot about sundowning — here's the article we've been leaning on."
- No edit affordance. Citations are derived state, not user-editable.

#### Section 8 — Your data

This is actually the home for the TASK-032 "Download / Delete" buttons + retention summary table. They belong here alongside transparency, not buried at the bottom of the profile form. Coordinate with TASK-032 so there's one section, not two — the final placement is decided at merge of whichever ticket lands second.

### 2. "Forget this" semantics per field

`/app/profile` Section 6 lets the user tap an individual bullet and mark it forgotten. Implementation:

- New table `conversation_memory_forgotten`:

  ```
  id uuid pk
  conversation_id uuid not null references conversations(id) on delete cascade
  user_id uuid not null references users(id) on delete cascade
  forgotten_text text not null    -- the exact bullet text the user tapped
  forgotten_at timestamptz not null default now()
  ```

- On next refresh, the refresh prompt is augmented with: "The caregiver has asked you to forget the following facts. Do not re-introduce them into the summary: <forgotten list>." This is soft-enforced via prompt; the post-generation verifier also runs a substring check on the forgotten list and retries if any is present.
- Hard limit: 30 forgotten items per conversation; oldest age out. Forgets clear on "Clear memory for this conversation."

On the **care profile side**, forget is just an edit — the user already has the full edit surface from TASK-020. Do not build a second mechanism. Mention this in the UI copy so the user understands.

### 3. Observability

- Log every "Forget this" tap to `user_actions` (new table, or reuse `admin_audit` with a different actor kind; decide in ADR).
- A tile on `/internal/metrics` (TASK-029): how often users are tapping "Forget this" per week. A high rate flags memory-quality problems.

### 4. Accessibility + copy

- Every "Forget this" button has an aria-label naming the content being forgotten.
- Copy tone: matter-of-fact, not apologetic. ("We won't mention that again in this conversation." Not: "I'm so sorry we got that wrong…")
- The whole section is keyboard-navigable. Tab cycles through bullets; Enter on a bullet toggles forgotten state with a 5-second undo toast.

---

## API

```
GET   /api/app/transparency/memory           → { conversationId, summary, sourceMessageCount, refreshedAt }
POST  /api/app/transparency/memory/forget    body: { conversationId, text }
POST  /api/app/transparency/memory/refresh   body: { conversationId }
POST  /api/app/transparency/memory/clear     body: { conversationId }
GET   /api/app/transparency/citations        query: { days?: number }  → CitedModule[]
```

All session-gated. Forget/refresh/clear write audit rows.

---

## Tests

- Unit (`apps/web/test/transparency/memory-render.test.ts`): structured summary renders as separate bullets per heading; empty headings are omitted.
- Unit (`packages/rag/test/memory/forgotten.test.ts`): refresh prompt includes forgotten list; verifier rejects summary that reintroduces a forgotten string; regenerates once.
- Integration (`apps/web/test/api/transparency-memory.test.ts`): tap forget on a bullet → row in `conversation_memory_forgotten` → refresh → updated summary does not contain the bullet text.
- E2E (`apps/web/test/e2e/transparency.spec.ts`):
  1. Seed a 6-turn conversation. Visit `/app/profile` → section 6 shows the summary.
  2. Tap "Forget this" on a bullet. 5-second toast; let it commit.
  3. "Refresh memory now" — bullet no longer present.
  4. "Clear memory" — section empties; a new conversation starts memory over from turn 3.
  5. Section 7 lists modules cited in the last 30 days.

---

## Acceptance criteria

- Sections 6, 7, 8 land on `/app/profile` below the existing editor; section 8 is coordinated with TASK-032.
- Forget-this works per-bullet; regenerated summaries do not re-introduce forgotten content (verifier-enforced).
- Refresh + Clear work and audit.
- Citations-in-the-last-30-days list accurate (spot-check against `messages.citations`).
- Copy has legal / trust review — PM attaches approval in the PR description.
- ADR 0022 written.
- `pnpm lint typecheck test` green; eval doesn't regress.

---

## Out of scope

- Cross-conversation transparency. Each conversation's memory is shown separately; we don't build an aggregate "everything Hypercare remembers about you across all conversations" view. (ADR 0017 already excluded cross-conversation memory; this ticket doesn't change that.)
- Retrieval-result transparency ("the AI considered these 10 chunks and used these 3"). A debugging surface, not a user one. Stay inside `/internal/`.
- Editing the summary by hand. Users forget bullets; they don't rewrite them.
- Summary translation / localization.
- Export of the memory as a standalone file. It's in the TASK-032 export zip.

---

## Decisions to make in the PR

- **Section 8 placement: here or in TASK-032.** My vote: keep it in this ticket because the transparency framing is primary; TASK-032 ships the machinery, this ticket ships the visible home.
- **Forget storage.** The `conversation_memory_forgotten` table is a new write surface. Alternative: store the forgotten list as a jsonb column on `conversation_memory`. My vote: separate table — easier to inspect, cleaner migrations.
- **Conversation picker UX when there are many.** Default to most-recent, paginate if > 5 show "see older conversations →." My vote: ship default-most-recent only; revisit if beta users ask.
- **Whether Section 7 includes lessons taken.** Not in this ticket — lessons appear on the home screen already. Ship a tight "citations in conversations" list.

---

## Questions for PM before starting

1. **Copy tone on "Forget this."** Neutral? Friendly? My draft above is neutral. Please sign off.
2. **Aggregate across conversations — really deferred?** A user with 12 conversations might reasonably want one "what you remember about me" view. I think that's a sprint-5 question; ADR 0022 records the deferral.
3. **When a user clicks "Forget this" on a profile-derived bullet** (e.g. a bullet in the summary that says "lives with Margaret in same home" — that's derived from `care_profile.living_situation`), do we bounce them to the profile editor or do we let them forget just from the summary? My vote: bounce them — derivation is the source of truth; forgetting a derived fact without editing the source is misleading.

---

## How PM verifies

1. Seed a multi-turn conversation. Visit `/app/profile`. Section 6 shows the structured summary.
2. Tap "Forget this" on a bullet. Toast. Undo; tap again; commit.
3. "Refresh memory now" — summary updates; forgotten bullet stays gone.
4. "Clear memory." Section 6 empties.
5. Ask three more questions. Section 6 regenerates.
6. Scroll to Section 7 — shows the modules cited in the last 30 days.
7. Scroll to Section 8 — retention table + Download / Delete buttons (coordinated with TASK-032).
8. Read ADR 0022.
