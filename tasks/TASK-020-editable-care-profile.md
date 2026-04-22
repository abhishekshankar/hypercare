# TASK-020 — Editable care profile (Screen 7) + "My situation has changed" flow + change-log writes

- **Owner:** Cursor
- **Depends on:** TASK-007 (onboarding writes to `care_profile`), TASK-019 (`care_profile_changes` table)
- **Unblocks:** TASK-024 (the picker reads `care_profile` and the change-log)
- **Status:** in_review
- **ADR:** Light update to `docs/adr/0005-onboarding-stage-rules.md` (no new ADR needed unless the evolved-state stage rules diverge).

---

## Why this exists

The PRD calls the care profile "the spine of the product" (§5) and explicitly names it as a transparency layer (§6.7) — caregivers should be able to **see and control** what the AI is using to personalize. Sprint 1 shipped the read-only profile screen as a side effect of TASK-007; sprint 2 makes it editable.

The other reason this matters now: TASK-024's lesson picker reads from `care_profile` (stage, "hardest thing right now," what-matters notes) and from the new `care_profile_changes` log to surface "your situation changed last week, here's a relevant lesson." If profile edits don't write to the log, the picker has no signal.

Two flows on the screen:
1. **Section-by-section edit** — each of the five §5 sections has its own edit affordance (Edit button → inline form → Save / Cancel). Standard CRUD.
2. **"My situation has changed" evolved-state flow** — a prominent button (PRD §5.6) walks the user through a short evolved-state questionnaire (the same 6–8 stage questions from §5.2 plus the §5.4 "How are you doing?" + "hardest thing now" prompts). Inferred-stage transitions are flagged for the picker.

---

## Context to read first

1. `prd.md` §5 (the five care-profile sections — these are the source of truth for the form), §5.6 (evolution), §6.7 (Screen 7 description).
2. `apps/web/src/app/(authed)/app/profile/page.tsx` — the existing read-only profile screen from TASK-007.
3. `apps/web/src/app/onboarding/**` — the existing onboarding wizard step components and their zod schemas. **You will reuse those forms here**; don't fork.
4. `docs/adr/0005-onboarding-stage-rules.md` — the stage inference rules. The evolved-state flow re-runs them.
5. `packages/db/src/schema/care-profile.ts` and (after TASK-019) `packages/db/src/schema/care-profile-changes.ts`.
6. `apps/web/src/lib/auth/session.ts` — auth gate for the new Route Handlers.

---

## What "done" looks like

### Screen 7 surface (`/app/profile`)

- Greeting line preserved from TASK-007.
- Five collapsible sections, in §5 order: **About the person**, **Stage**, **Living situation**, **About you**, **What matters to [name]**.
- Each section header shows a one-line summary of the current state ("Margaret, 78, Alzheimer's, ~2 years since diagnosis"). Click expands to show the full section + an "Edit" button.
- Edit reveals the same form component used in onboarding for that section, pre-filled. **Save** posts to `/api/app/profile/section/{section}` with a zod-validated body, writes both the `care_profile` update and the `care_profile_changes` row(s), and collapses the section back. **Cancel** discards.
- Optimistic UI is fine but the loading + error states must be visible (small inline spinner during the request, inline error message on failure). On 401 redirect to login (use existing helper).
- A prominent **"My situation has changed"** button at the top of the screen (PRD §5.6) opens a dedicated route, not an inline form (see below).
- Below the sections, a small "Recent changes" list (last 5 from `care_profile_changes`, oldest at the bottom) — `2 days ago — You updated "hardest thing right now" from "sleep" to "guilt"`. Read-only. No undo in v0.

### "My situation has changed" flow (`/app/profile/changed`)

- A 4-step wizard, mirroring the onboarding flow's component shape but **only** asking the questions whose answers are likely to have shifted:
  1. **Stage check** — re-run the 6–8 §5.2 behavioral questions, pre-filled with current answers. The user can keep, change, or skip.
  2. **Care situation** — the §5.3 living/care questions, pre-filled.
  3. **About you** — the §5.4 "How are you doing?" 1–5 + "hardest thing right now" chips/free text, pre-filled.
  4. **Anything else?** — single free-text "What's new that I should know?" field, optional.
- On Save:
  - Diff against current `care_profile`.
  - Write one `care_profile_changes` row per changed field (`trigger = 'evolved_state_flow'`).
  - Update `care_profile` in place.
  - **Re-infer stage** using the existing `inferStage()` helper. If the inferred stage changed, write an additional `care_profile_changes` row for the `stage` field with `trigger = 'system_inferred'` and the section `stage`.
  - Redirect to `/app/profile` with a small banner: "Saved. Your this-week's-focus may shift to match."
- "Skip for now" button on every step. Skipping all four still records nothing (no empty change-log spam).

### API surface

```
POST   /api/app/profile/section/about_cr       body: zod schema for the §5.1 fields
POST   /api/app/profile/section/stage          body: stage answers (the 6–8 §5.2 questions)
POST   /api/app/profile/section/living         body: §5.3 fields
POST   /api/app/profile/section/about_you      body: §5.4 fields (incl. "hardest thing now")
POST   /api/app/profile/section/what_matters   body: §5.5 free-text fields
POST   /api/app/profile/changed                body: { stage?, living?, about_you?, anything_else? }
GET    /api/app/profile/changes?limit=5        returns recent change-log rows
```

All require session. All validate with `zod`. All return `{ ok: true, changedFields: string[], inferredStage?: Stage | null }`. Unauthenticated → 401 JSON (per ADR 0010 / TASK-011 convention; no redirect on `/api/app/*`).

### Change-log write semantics

- One row **per field that actually changed** (deep equality on jsonb). No-op edits (Save with no changes) write nothing.
- `old_value` is the prior value as jsonb; first-time set has `old_value = null`.
- `trigger` per the §5.6 distinction: `user_edit` for section saves, `evolved_state_flow` for the wizard, `system_inferred` for stage re-inference.
- Writes happen in the same DB transaction as the `care_profile` update so a partial-failure doesn't leave the log out of sync.

### Tests

- Unit (vitest, in `apps/web/test/`): each section form's zod schema accepts the onboarding fixture and rejects an obviously bad payload.
- Unit: change-diff helper writes one row per changed field, zero rows when nothing changed.
- Playwright E2E (`apps/web/test/e2e/profile.spec.ts`):
  1. Log in (use the existing test session helper from TASK-011), open `/app/profile`, expand "About you," change "hardest thing now," save. Assert the section collapses and "Recent changes" shows the new entry.
  2. Open the changed-flow, walk all four steps changing one stage answer, save. Assert: `care_profile_changes` has a row for the changed stage answer; if the inferred stage flipped, a second row; landing back on `/app/profile` shows both in "Recent changes."
  3. Open the changed-flow, skip every step, save. Assert: zero rows in `care_profile_changes` for that timestamp window.

Mock the inference helper at the module boundary if it gets in the way; do not mock the DB — the E2E hits the real test DB the same way the conversation E2Es do.

---

## Acceptance criteria

- `pnpm --filter web typecheck lint test` green; `pnpm --filter web build` green.
- `/app/profile` renders all five §5 sections with the right pre-fill and per-section edit.
- Section edits write `care_profile` + one or more `care_profile_changes` rows in the same transaction; no rows on no-op saves.
- "My situation has changed" wizard at `/app/profile/changed` walks four steps, supports skip-per-step, and writes `evolved_state_flow`-tagged rows on save.
- Stage re-inference fires on the wizard save; if the inferred stage changed, an additional `system_inferred` row is written.
- "Recent changes" list shows the last 5 rows in human language (use a small lookup in `apps/web/src/lib/profile/change-copy.ts` so the wording isn't tangled into the page).
- Playwright E2E covers the three flows above.
- Section forms reuse the onboarding form components (no parallel implementation; if you need to extract a shared component, do it as a small refactor inside this PR and call it out in the report-back).

---

## Files to create / modify

### Create

```
apps/web/src/app/(authed)/app/profile/page.tsx                    # replace read-only body
apps/web/src/app/(authed)/app/profile/changed/page.tsx
apps/web/src/app/(authed)/app/profile/changed/_steps/Step1Stage.tsx
apps/web/src/app/(authed)/app/profile/changed/_steps/Step2Living.tsx
apps/web/src/app/(authed)/app/profile/changed/_steps/Step3AboutYou.tsx
apps/web/src/app/(authed)/app/profile/changed/_steps/Step4AnythingElse.tsx
apps/web/src/app/api/app/profile/section/[section]/route.ts
apps/web/src/app/api/app/profile/changed/route.ts
apps/web/src/app/api/app/profile/changes/route.ts
apps/web/src/components/profile/SectionPanel.tsx
apps/web/src/components/profile/RecentChanges.tsx
apps/web/src/lib/profile/change-diff.ts
apps/web/src/lib/profile/change-copy.ts
apps/web/src/lib/profile/persist.ts                # writes care_profile + change-log in one tx
apps/web/test/e2e/profile.spec.ts
```

### Modify

```
apps/web/src/app/(authed)/app/profile/page.tsx     # was the read-only screen
apps/web/src/components/onboarding/*               # extract shared sub-components if needed
TASKS.md
```

### Do **not** touch

- The CrisisStrip, the auth middleware, any RAG/safety internals.
- Onboarding routes themselves (we reuse the components, not the routes).
- Any sprint-1 migration. Schema changes belong in TASK-019.

---

## Out of scope

- Multi-CR profiles (PRD §4.1 — v2).
- Family / shared-edit (v2).
- Undo / version revert from "Recent changes."
- Profile import/export / "give me my data" (separate ticket post-v1).
- Soft-delete of profile fields (no UI for this v1).
- Telling the user "the AI now knows X" beyond the small banner — the transparency surface is the profile screen itself.

---

## Decisions to make in the PR

- **Whether to extract the onboarding step components into a `components/care-profile/` shared module** or keep them in `components/onboarding/` and import from there. Both are fine; pick the one that means fewer file moves. Document in the report-back.
- **The "Recent changes" copy table.** Use natural language ("You changed X from A to B"); don't expose `field` slugs to the user. Keep the table in `change-copy.ts` so a non-engineer can edit it.
- **Banner text on save.** "Saved. Your this-week's-focus may shift to match." is my draft; rewrite if you have a better one and call it out.

---

## Questions for PM before starting

1. The "My situation has changed" wizard — 4 steps as drafted, or strip to 2 (stage + about-you)? My vote: ship 4, the §5.6 flow is supposed to feel substantive.
2. Should "Recent changes" be permanent on the profile screen, or hidden behind a "Show history" toggle? My vote: visible, last 5, with a "View all" link that goes to a stub page in v0.
3. Re-inference policy — re-run on every stage-section save (cheap, transparent), or only on the wizard save? My vote: every save, but only **write a `system_inferred` row** if the inferred stage actually changed. Otherwise the log fills up with no-op rows.

---

## How PM verifies

1. Local dev, log in, `/app/profile`. Confirm all 5 sections render with current data, expand cleanly, and each Edit reveals the right form.
2. Edit "About you" → change "hardest thing now" → Save. Section collapses, "Recent changes" shows the new entry.
3. Click "My situation has changed" → walk all 4 steps, change one stage answer that should flip stage early→middle, save. Check `care_profile_changes` in psql for two rows (the user_edit and the system_inferred stage flip).
4. Re-open the wizard, hit "Skip" on every step, save. Confirm no new `care_profile_changes` rows for that minute.
5. Check the Playwright report — three specs green.

---

## Report-back

- Branch + PR + acceptance checklist mirror.
- Screenshots: profile screen with one section expanded, "Recent changes" populated, the changed-flow step 1.
- Decisions you landed on (the three above).
- Any onboarding component you had to refactor — flag if the diff turned bigger than you expected.
