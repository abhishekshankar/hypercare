# ADR 0005 — Onboarding stage inference, completion gate, and summary ack

## Context

TASK-007 ships the five-step care profile wizard, stage inference from behavioral answers, a template summary, and routing gates for `/app` vs `/onboarding`.

## Decision — stage rules (v1)

Implemented in `apps/web/src/lib/onboarding/stage.ts` as a pure function `inferStage(answers)`:

1. **Late** when at least two of the following hold: `recognizes_you === "no"`, `bathes_alone === "no"`, `conversations === "no"`, `wandering_incidents === "yes"`, **and** `left_alone === "no"`.
2. **Middle** when not late and any of: `manages_meds === "no"`, `bathes_alone === "no"`, `left_alone === "no"`, `wandering_incidents === "yes"`, `sleeps_through_night === "no"`.
3. **Early** when not late, not middle, and at least five of the eight questions are answered (`yes` / `no` / `unsure`); otherwise `null`.

The inferred label is **never** shown in the UI; the summary uses plain-language observations only.

`stage_answers` keys (stable for TASK-008+): `manages_meds`, `drives`, `left_alone`, `recognizes_you`, `bathes_alone`, `wandering_incidents`, `conversations`, `sleeps_through_night`.

## Decision — persistence

- **Server actions** in `apps/web/src/app/(authed)/onboarding/_actions.ts` (not route handlers): one action per step, `redirect()` on success, partial upsert/update per step.
- Step 4 also updates `users.display_name`.

## Decision — “completed onboarding” without a new DB column

TASK-007 requires: ticket-minimum profile fields **and** that the user sees the summary and confirms. There is no `onboarding_completed` column in TASK-004.

- **Wizard data complete** (`isWizardDataCompleteFromSnapshot`): `display_name` on `users`, `cr_first_name`, `cr_relationship`, ≥5 non-null stage answers, step 3–4 required fields, and step 5 submitted (we persist `cr_background` on every step-5 submit, including empty string, so `cr_background IS NOT NULL` marks step 5 done).
- **Acknowledgment**: httpOnly cookie `hc_onboarding_ack=1` set by `confirmOnboardingSummary` after “Looks right.”
- **`hasCompletedOnboarding`**: wizard data complete **and** ack cookie present.

The cookie is cleared on **new login** (`/api/auth/callback`) and **logout** so sessions do not inherit another user’s ack.

## Decision — summary copy

`composeOnboardingSummary` in `apps/web/src/lib/onboarding/summary.ts` is a deterministic template (not LLM-generated), opening with “Okay.” and closing with `hardest_thing` when set, else “Let’s get started.”

## Consequences

- Care Specialist can revise stage rules in sprint 2 without migrations; TASK-008+ can rely on stable `stage_answers` keys.
- E2E and local dev need a reachable `DATABASE_URL` for wizard tests; Playwright uses `GET /api/test/e2e-session` (NODE_ENV=test + `E2E_SETUP_SECRET`) to mint a session and reset the stable test user’s profile.

## Update (TASK-020) — after onboarding

- **Section-by-section profile edits** on `/app/profile` re-run `inferStage()` on **stage** (§5.2) saves; a `care_profile_changes` row with `trigger = 'system_inferred'` is written **only** when the inferred label actually changes, so the log does not fill with no-op inferences.
- The **"My situation has changed"** flow (`/app/profile/changed`) applies the same inference rule on save, with user-facing changes mostly tagged `evolved_state_flow` in the change-log.
