# TASK-007 — Onboarding flow (5 sections from PRD §5), writes to `care_profile`

**Owner:** Cursor
**Depends on:** TASK-004, TASK-006
**Status:** completed

## Why this exists

The care profile is the spine of the product (PRD §5). Every personalized answer, every retrieval metadata filter, and every safety-classifier preamble reads from it. Today the `care_profile` table exists (TASK-004) and a signed-in user exists (TASK-006), but a freshly signed-in user has no row — and without one, TASK-009's prompt composition has nothing to inject and TASK-011's home screen has nothing to greet them with. This ticket is the one that captures the profile.

**What it is:** a 5-step form over the PRD §5 structure, writing one `care_profile` row per user. That's it.

**What it is not:** the final UX. Typography, copy, micro-interactions, chip starters for free-text fields, and the "My situation has changed" evolution flow (PRD §5.6) are sprint 2. Sprint 1 ships the data-capture path end-to-end, prose-only, so the vertical slice is real.

## Context to read before starting

- `prd.md §5` — five sections, every field. **The ticket's field list below matches TASK-004's columns; if you think you need a different field, stop and ask.** Do not invent new columns without PM sign-off.
- `prd.md §5.2` — the 8 behavioral stage questions. **Use the PRD's wording verbatim** for v1. The Care Specialist will refine in sprint 2 (tracked as an open question on `TASKS.md`). Do not paraphrase.
- `prd.md §6.2` — Screen 2 specs: 5 short steps, one question per screen on mobile, 2–3 on desktop, progress bar, persistent micro-copy "You can change any of this later," target 4–5 minutes, a summary screen at the end that reflects back what was captured in plain English.
- `prd.md §4.1` — "One caregiver, one care recipient, one profile." Enforced in TASK-004 with a unique constraint on `care_profile.user_id`; the UI must respect it.
- `packages/db/src/schema/care-profile.ts` — the source of truth for field names, types, and CHECK-constraint values. Every form field maps to one column; every enum-style select uses the values from the CHECK constraint verbatim.
- `apps/web/src/app/(authed)/` — TASK-005's route group. Onboarding is outside the `(authed)/app` group because we want it behind auth but not under `/app/**` (PRD §6.2 implies onboarding happens before "home"). **See "Routing" below for the exact placement decision.**
- `apps/web/src/lib/auth/session.ts` — use `requireSession()` to enforce auth on every onboarding route.

## What "done" looks like

A signed-in user at `/onboarding` walks through 5 steps, submits, and a `care_profile` row exists for their `user_id` with the correct fields populated. Their `users.display_name` is set from Section 4's "Your first name" field. A sixth screen renders the PRD §6.2 summary paragraph ("Okay. You're caring for your mom Margaret, 78, who …") reflecting the submitted data. Subsequent visits to `/onboarding` recognize that a profile exists and 302 to `/app`. The home screen at `/app` now greets the user by name and the CR by name.

## Acceptance criteria

### Routing

- [ ] Move the onboarding route **into** the `(authed)` group: `apps/web/src/app/(authed)/onboarding/...`. TASK-005's `/onboarding/page.tsx` outside the group is deleted in this PR. Justification: onboarding requires auth; keeping it in the `(authed)` group means `requireSession()` is applied consistently and future route-group layouts (sidebars, footers) apply cleanly.
- [ ] The authed landing logic (see TASK-006 `requireSession()` plus this ticket's gate): after login, if no `care_profile` row exists, redirect to `/onboarding/step/1`; otherwise land on `/app`. Implement the check as a tiny server helper `hasCompletedOnboarding(userId): Promise<boolean>` in `apps/web/src/lib/onboarding/status.ts` (not in the auth layer — onboarding is a product concern, not an auth concern).
- [ ] Routes:
  - `/onboarding` — redirects to `/onboarding/step/1` if incomplete, to `/app` if complete.
  - `/onboarding/step/[n]` — `n ∈ {1..5}`. Renders the step's form.
  - `/onboarding/summary` — renders the read-back paragraph + a "Looks right" primary button → `/app`, and an "Edit" link back to `/onboarding/step/1`.
- [ ] A URL-mode `?edit=1` on any step is **out of scope**. Editing the full profile is Screen 7 (sprint 2). Step navigation within onboarding uses Back / Continue only.

### Form UX (sprint-1 minimal — no custom widgets)

- [ ] The five steps, in order. One `<form>` per step, one `next` action that persists partial progress and advances.
  1. **Section 1 — About [CR]:** `cr_first_name` (text, required), `cr_age` (number, 0–120, optional), `cr_relationship` (radio: parent / spouse / sibling / in-law / other), `cr_diagnosis` (radio: alzheimers / vascular / lewy_body / frontotemporal / mixed / unknown_type / suspected_undiagnosed, optional — allow "prefer not to say" which stores `null`), `cr_diagnosis_year` (number year, optional). Progress: "Step 1 of 5."
  2. **Section 2 — Stage assessment:** the 8 questions from PRD §5.2. Each is a yes/no/unsure radio. **Use the exact PRD wording, with `[name]` interpolated to the `cr_first_name` captured in step 1.** Store the 8 answers as a JSON object in `stage_answers` (see "Stage inference" below for keys).
  3. **Section 3 — Living/care situation:** `living_situation` (select from CHECK values), `care_network` (select from CHECK values), `care_hours_per_week` (number, optional), `caregiver_proximity` (radio: same_home / same_city / remote).
  4. **Section 4 — About you:** `display_name` (text, goes to `users.display_name` — not `care_profile`), `caregiver_age_bracket` (radio over CHECK values), `caregiver_work_status` (radio), `caregiver_state_1_5` (radio with the PRD's humane phrasing: 1 "I've got this" → 5 "I'm at the end of my rope"), `hardest_thing` (textarea, max 500 chars, optional — no chip starters in v1; sprint 2 adds them).
  5. **Section 5 — What matters to [CR]:** `cr_background`, `cr_joy`, `cr_personality_notes` — each a textarea, each max 500 chars, all optional.
- [ ] Progress bar component rendered on every step showing `n / 5`. No step numbering in the URL besides `step/[n]` — the component reads the param.
- [ ] Persistent micro-copy "You can change any of this later" below the progress bar. Required by PRD §6.2.
- [ ] Back button on steps 2–5. Forward button labeled "Continue"; the step-5 forward button reads "See what I told Hypercare."
- [ ] Validation is server-side via `zod` schemas in `apps/web/src/lib/onboarding/schemas.ts`. Fields with CHECK constraints get `z.enum([...])` whose members match the DB values exactly. Client-side required-field marking is fine; authoritative validation is on the server.
- [ ] Error display is inline under each field. A summary block at the top names the count of errors and focuses the first invalid field.

### Persistence

- [ ] Writes run on the server, in Route Handlers or server actions under `apps/web/src/app/(authed)/onboarding/_actions.ts` (pick one — server actions are cleaner for form posts; document in PR).
- [ ] On each step submit, upsert `care_profile` keyed on `user_id` (the `on delete cascade` + `unique(user_id)` from TASK-004 makes this clean). Partial progress is persisted at every step so a mid-flow refresh doesn't lose work. Missing fields are written as `null`.
- [ ] On step 4 submit, **also** update `users.display_name`.
- [ ] The final submit (from summary or step 5) does not touch the DB beyond what step 5 already wrote; it only flips the user into the "onboarded" state. "Onboarded" is derived (see below), not stored in a column, so no extra write.
- [ ] Use `hypercare_app` via `DATABASE_URL`. No admin role.

### Stage inference

- [ ] `stage_answers` JSONB shape: `{ manages_meds, drives, left_alone, recognizes_you, bathes_alone, wandering_incidents, conversations, sleeps_through_night }` — each value `"yes" | "no" | "unsure" | null`. Keys stable; TASK-008 onward may reference them.
- [ ] `inferred_stage` is computed at step-2 submit with a small rule function in `apps/web/src/lib/onboarding/stage.ts`. The rules for v1 — accept that they will be revised by the Care Specialist in sprint 2:
  - **Late** if two or more of: `recognizes_you === "no"`, `bathes_alone === "no"`, `conversations === "no"`, `wandering_incidents === "yes"` **and** `left_alone === "no"`.
  - **Middle** if any of: `manages_meds === "no"`, `bathes_alone === "no"`, `left_alone === "no"`, `wandering_incidents === "yes"`, `sleeps_through_night === "no"` and none of the "late" triggers fire.
  - **Early** otherwise, **only** if at least 5 of the 8 are answered; if fewer, leave `inferred_stage` null and the home screen will not personalize on stage.
- [ ] Pure function. Unit tests cover the three buckets plus the "not enough answers → null" path. Tests are in `apps/web/src/lib/onboarding/stage.test.ts`.
- [ ] **Never surface the word "early / middle / late" to the user.** Internal label only. The summary screen describes what was observed ("You mentioned Margaret needs help with bathing and sometimes wanders") rather than the stage bucket. PRD §5.2 is explicit.

### "Has completed onboarding" rule

- [ ] `hasCompletedOnboarding(userId)` returns true iff a `care_profile` row exists for the user **and** the required fields are populated: `cr_first_name`, `cr_relationship`, at least 5 of the 8 stage answers, and `display_name` on `users`. Anything else is optional.
- [ ] This helper is called in two places: the `/onboarding` redirect gate, and the `/app` landing page (which, if not onboarded, 302s back to `/onboarding/step/1`). Consolidate the logic; don't duplicate.

### Summary screen

- [ ] `/onboarding/summary` renders a paragraph in the style of PRD §6.2's example: warm, specific, short. Compose it server-side from the submitted data; do not call an LLM (PRD §8 "content is sourced and reviewed" — this is not generative content, it's a read-back).
- [ ] Template (one paragraph, no bullets):
  - Opens with "Okay. " and uses `display_name` and `cr_first_name`.
  - Describes the relationship and living situation ("…caring for your mom Margaret, 78, who was diagnosed with Alzheimer's two years ago and lives with you").
  - Closes by naming `hardest_thing` if set: "The hardest thing right now is sundowning. Let's start there." If `hardest_thing` is empty, close with "Let's get started."
- [ ] Below the paragraph: "Looks right" → `/app`; "Edit" → `/onboarding/step/1`.
- [ ] Unit test the summary composer against 4–5 fixtures covering: all fields set, minimal required-only, missing diagnosis year, missing `hardest_thing`, remote caregiver vs same-home.

### Home-screen greeting wiring

- [ ] Update `(authed)/app/page.tsx` — which TASK-006 leaves as "Signed in as {email}" — to read the care profile and render one sentence: "Good morning, {display_name}." on a line, "Caring for {cr_first_name}." on the next. That's it. No week's-focus card, no input, no conversation list. Those belong to TASK-011.
- [ ] If the user somehow reaches `/app` without a completed profile (race condition or direct URL), redirect to `/onboarding/step/1`.

### Accessibility

- [ ] Every form field has a `<label htmlFor>`. Radio groups use `<fieldset>` + `<legend>`. Error text uses `aria-describedby` on the invalid input.
- [ ] Progress bar exposes `role="progressbar"` with `aria-valuenow`, `aria-valuemin=1`, `aria-valuemax=5`, and a visible label.
- [ ] Keyboard: Tab order matches visual order; Enter submits the step.
- [ ] The persistent crisis strip from TASK-005 remains visible on every onboarding screen — no changes needed, the route-group layout already mounts it.

### Tests

- [ ] Vitest unit tests for: each `zod` schema (happy path + at least one invalid case per field), the stage-inference rules (all three buckets + insufficient-answers path), the summary composer (fixtures above), `hasCompletedOnboarding`.
- [ ] A single Playwright E2E: sign in (via the TASK-006 test shortcut), walk through all 5 steps with valid inputs, hit the summary, click "Looks right," land on `/app`, assert the greeting. Then visit `/onboarding` again → 302 to `/app`.

### Lint / typecheck / build

- [ ] `pnpm lint && pnpm typecheck && pnpm -r build && pnpm test` green with zero warnings.

## Files you will likely create / touch

```
apps/web/
  src/
    app/
      (authed)/
        onboarding/
          layout.tsx                        (shared progress-bar shell)
          page.tsx                          (redirect logic)
          step/[n]/page.tsx
          summary/page.tsx
          _actions.ts                       (server actions; or split into route.ts)
        app/page.tsx                        (update greeting — minimal change)
    components/onboarding/
      progress-bar.tsx
      radio-group.tsx                       (small unstyled wrapper; not a UI kit)
      labeled-input.tsx                     (same)
    lib/onboarding/
      schemas.ts                            (zod per-step)
      stage.ts                              (pure inference)
      summary.ts                            (pure composer)
      status.ts                             (hasCompletedOnboarding)
      stage.test.ts
      summary.test.ts
      schemas.test.ts
      status.test.ts
    test/e2e/
      onboarding.spec.ts
docs/
  adr/0005-onboarding-stage-rules.md         (number follows 0004-auth-session-model.md)
```

## Out of scope — do not do these here

- **Editable care profile UI beyond onboarding.** Screen 7 (`/app/profile`) stays a stub; sprint 2 builds the editor. `TASKS.md` explicitly defers this.
- **"My situation has changed" evolution flow** (PRD §5.6). Sprint 2.
- **Chip starters** for `hardest_thing` (PRD §5.4 mentions them). Sprint 2.
- **Weekly check-in prompt** (PRD §5.6). Sprint 2.
- **LLM-generated summary paragraph.** The read-back is a template, not a generation. Grounded content only (PRD §8).
- **Stage label as a user-facing string.** Never render "early / middle / late" to the user. Use observed behavior language.
- **Care-profile read path for the RAG pipeline.** TASK-009 reads the profile; this ticket only writes it.
- **Schema migrations.** TASK-004's shape is sufficient. If you believe it isn't, stop and raise it.

## How the PM will verify

1. `pnpm install && pnpm --filter web dev`. Sign in as a test user with no prior profile.
2. Land at `/app` → auto-redirect to `/onboarding/step/1`.
3. Walk through all 5 steps. Refresh mid-flow on step 3 → step 3 re-renders with the partial data preserved (via the DB round-trip, not localStorage).
4. Submit step 5 → summary screen shows the read-back paragraph using the values entered. Hit "Looks right" → `/app` shows "Good morning, {name}. / Caring for {cr_first_name}."
5. Visit `/onboarding` again → 302 to `/app`.
6. Against `hypercare_dev` via the SSM tunnel, `SELECT * FROM care_profile WHERE user_id = <id>` shows one row with fields populated; `inferred_stage` matches the rule table (give one "clearly middle" profile and confirm); `users.display_name` is set.
7. Try to submit step 1 with `cr_first_name` blank → server-side `zod` error is returned and rendered inline; no DB write.
8. Playwright suite passes: `pnpm --filter web test:e2e`.

## Decisions Cursor will make and report

- **Server actions vs Route Handlers** for the form posts. Either is fine; name the choice.
- **Form partial-save strategy** — write on every "Continue," vs debounce during typing. Prefer on-continue (simpler, fewer writes, good enough for a 4–5 minute flow).
- **Radio vs select** for enum fields. The ticket says "radio" for most; if a list is long enough that a radio feels bad (e.g., `cr_diagnosis` with 7 values), use a native `<select>` and justify.
- **Summary composer tone** when some fields are null. Submit your chosen templates in the PR for PM to review; this is brand-adjacent copy and may round-trip.

## Questions Cursor is likely to have

- "Should incomplete onboarding persist across sessions?" — Yes. The `care_profile` row is written on every "Continue." A user can close the browser and come back; `/onboarding` routes them to the first incomplete step. Implement "first incomplete step" as a small helper — simplest heuristic is the first step whose required fields aren't all populated.
- "What if the user signs out mid-onboarding?" — Their partial row stays. Next sign-in lands them back at the first incomplete step.
- "Should I block navigating backward from summary to steps?" — No. They can always edit.

## Report-back template

Use `PROJECT_BRIEF.md §7`. Include:

- The five step URLs and the summary URL with screenshots.
- The SQL SELECT output showing a full row.
- The stage-inference rule table actually shipped (in case it deviates).
- The summary composer templates for each fixture.
- Any PRD-vs-DB mismatch you hit and how you resolved it.
