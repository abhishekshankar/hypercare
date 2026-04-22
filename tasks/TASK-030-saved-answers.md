# TASK-030 — Saved answers + "Things to revisit" surface

- **Owner:** Cursor
- **Depends on:** TASK-011 (conversation UI already renders a "Save this" button per PRD §6.4, but today it's non-persisting), TASK-019 (schema v1 is the cleanest place to add the table)
- **Unblocks:** closes the PRD §6.3 "recent conversations, saved answers, and a 'Things I want to revisit' list" promise; feeds the sprint-4 "review surface" feature set
- **Status:** pending
- **ADR:** none strictly required (small, additive). An optional ADR-light one-pager under `docs/adr/0020-saved-answers.md` is welcome for the decision on "save a message" vs "save a conversation."

---

## Why this exists

PRD §6.4 names a "Save this" button on every assistant turn. PRD §6.3 says the home screen's below-the-fold area shows *"recent conversations, saved answers, and a 'Things I want to revisit' list."* TASK-011 rendered the save button but left it as a no-op; TASK-024's "Revisit" button on the lesson close card writes to `lesson_progress.revisit = true` but that's a different surface.

Real caregivers use a save-for-later affordance heavily — they get an answer at 2am, they want to remember "what the product said about refusal of care" a week later. The ask-anything input is a 2am surface; saves are the 2pm follow-up. Missing this makes the product feel disposable.

---

## Context to read first

1. `prd.md` §6.3 (home screen composition), §6.4 (Save this + thumbs on every assistant turn).
2. `apps/web/src/components/conversation/AssistantTurn.tsx` (or wherever TASK-011 rendered the save button) — replace the no-op with a real call.
3. `apps/web/src/app/(authed)/app/page.tsx` — the home screen; add a section for saved items below the existing "recent conversations."
4. `packages/db/src/schema/messages.ts` — the assistant-turn rows. Saves reference a message_id.

---

## What "done" looks like

### 1. Schema

```
saved_answers
  id uuid pk
  user_id uuid not null references users(id) on delete cascade
  message_id uuid not null references messages(id) on delete cascade
  note text                                   -- optional free-text note at save time
  saved_at timestamptz not null default now()
  unique (user_id, message_id)
```

Migration under `packages/db/migrations/`, documented in `docs/schema-v1.md`.

Why a separate table rather than a boolean on `messages`: the message table grows fast, and a sparse boolean is inefficient. A separate table keeps the read path for "my saves" fast and allows future per-save metadata (tags, notes, snoozed-until) without touching `messages`.

### 2. API

```
POST    /api/app/saved-answers              body: { message_id, note? }        → { id }
DELETE  /api/app/saved-answers/[id]         → { ok: true }
GET     /api/app/saved-answers              query: { q?: string; limit?: number; cursor?: string }  → { items: SavedItem[]; nextCursor? }
```

`SavedItem` shape:

```ts
type SavedItem = {
  id: string;
  message_id: string;
  conversation_id: string;
  saved_at: string;
  note?: string;
  assistant_text_preview: string;    // first ~280 chars of the assistant message
  question_text: string;              // the preceding user message text, for context
  module_slugs: string[];             // citations the saved answer drew from (from messages.citations jsonb)
};
```

`q` search: ilike on the assistant message body + the question text + the note. No FTS index in v0 (small N expected); add GIN trigram if results are slow at 1k+ saves.

All routes require session, 401 otherwise, zod-validated.

### 3. UI: the save button

In `AssistantTurn.tsx`:

- Replace the no-op save with `POST /api/app/saved-answers`. On success, toggle to "Saved" (checkmark). On duplicate (409), same.
- After save, show a small inline field for an optional one-line note ("Why are you saving this?"). Empty-OK. Save on blur; patch API: `PATCH /api/app/saved-answers/[id]` with `{ note }`.
- Toggle to unsave: click again → DELETE. Confirmation not required (the button is idempotent; user can re-save).
- Saves are only allowed on assistant turns (not user turns, not escalation cards — PRD §10.3 escalation responses are transient by design).

### 4. UI: home screen section

Under the existing "recent conversations" section on `/app`, add a "Things to revisit" section:

- Section title: "Things to revisit."
- Up to 5 most recent saves, each rendered as:
  - First line: the user's original question ("How do I get Margaret to shower?")
  - Second line: the first ~120 chars of the assistant preview.
  - Meta: saved 3 days ago · from conversation about …
  - Tap → `/app/conversation/[id]#message-[mid]` (jump to the message).
- "See all →" link → `/app/saves`.
- Empty state: "Nothing saved yet. Tap the bookmark on any answer that helps."

### 5. UI: `/app/saves` full list

- Search input at top — hits the `q` parameter.
- List view with infinite scroll or "Load more" (cursor pagination).
- Each item rendered like the home-screen block but with the note visible if present.
- Hover / long-press → "Remove." Confirmation: inline undo toast (5s) instead of a modal.

### 6. Anti-repeat consideration

TASK-024's lesson picker already has an anti-repeat rule for lessons. Consider whether a **saved answer** should influence the picker (a user saved a sundowning answer → surface sundowning-related lessons). My vote: **not in this ticket.** Saves are a user-driven retrieval surface; the picker has enough signal. Flag as future work.

---

## Tests

- Unit (`apps/web/test/api/saved-answers.test.ts`): CRUD, dedupe on (user_id, message_id), ilike search, cursor pagination.
- Unit (`apps/web/test/saved/preview.test.ts`): preview text builder — first 280 chars, strip markdown headings, preserve plain text.
- E2E (`apps/web/test/e2e/save-and-revisit.spec.ts`):
  1. Ask a question. Tap "Save this" on the response. See "Saved."
  2. Add a note ("for the conversation with my sister"). Reload. Note persists.
  3. `/app` → "Things to revisit" shows the save. Tap it. Land back on the conversation, scrolled to the saved message.
  4. `/app/saves` → see the save + search for a word in the answer → filtered.
  5. Unsave from `/app/saves`. Toast with undo. Let it expire. Refresh. Gone.

---

## Acceptance criteria

- `saved_answers` table shipped with migration + docs.
- Save / unsave works from the conversation surface.
- "Things to revisit" appears on `/app` below recent conversations with up to 5 saves.
- `/app/saves` full-list view with search + pagination + unsave.
- No saves on escalation (`safety_triaged`) responses — the save button doesn't render on those.
- Dedupe on `(user_id, message_id)` — a second save click is a no-op (or the note-edit affordance).
- `pnpm lint typecheck test` green; eval doesn't regress.

---

## Out of scope

- Folders / tags on saves.
- Exporting saves (PDF, email).
- Saves influencing retrieval or the lesson picker.
- Shared saves across family members (PRD §4.1 — multi-caregiver is v2).
- Push notifications on saves ("you saved this a week ago — want a reminder?"). Deferred.
- Bulk actions on `/app/saves`.
- Saving whole conversations instead of single messages. A conversation is already on "recent conversations"; saves are message-granular.

---

## Decisions to make in the PR

- **Jump target in the conversation view.** URL fragment `#message-<id>` + an IntersectionObserver scroll. Keep the anchor stable even if messages are added later — order by `created_at`, address by UUID.
- **Preview text length.** 280 chars for the list view, 120 for the home-screen teaser. Sign off.
- **Note field length.** 240 chars hard limit. Not a journal.
- **The "unsave" undo toast.** 5s window with a single Undo button; after 5s the delete is committed. Simpler than a soft-delete flag.

---

## Questions for PM before starting

1. **Should saves survive conversation deletion?** TASK-019 / TASK-011 have the conversations FK; cascading delete removes saves when the conversation is gone. Sign off, or do you want saves to outlive their conversation (which means we'd dereference and snapshot the message body)? My vote: cascade delete in v0; surface the implication in the "Remove conversation" flow if that exists.
2. **Placement on `/app`.** I've proposed saves **below** recent conversations. PRD §6.3 lists them in that order. Confirm, or do you want saves above recents?
3. **The note field visibility.** On `/app` home-screen teaser, show the note if present? My vote: yes, and use it in place of the preview when present — it's the user's own words.
4. **Anything saved + thumbs-down.** If a user saved a message and then thumbed-down later, leave the save? My vote: yes — user signal is user signal; don't moralize.

---

## How PM verifies

1. Log in; have a conversation; tap "Save this" on an answer; add a note.
2. Reload `/app`; the "Things to revisit" section shows the save with the note.
3. Tap into it; land on the conversation, scrolled to the saved message.
4. Ask another question; save that answer.
5. `/app/saves`; search a word from the first answer; see it filtered.
6. Unsave the second; undo-toast appears; let it expire.
7. `psql -c "select id, note, saved_at from saved_answers where user_id = '…' order by saved_at desc limit 5;"` — rows match the UI.
