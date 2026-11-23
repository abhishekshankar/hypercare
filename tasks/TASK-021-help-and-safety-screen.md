# TASK-021 — Help & Safety screen (Screen 8) + caregiver-burnout self-assessment

- **Owner:** Cursor
- **Depends on:** TASK-010 (safety classifier + flag log), TASK-019 indirectly (no schema changes here)
- **Unblocks:** Nothing in sprint 2 strictly, but it backstops TASK-024 (the lesson surface points to `/help` from refusal cards) and is the deliverable PRD §6.8 names directly.
- **Status:** in_review
- **ADR:** Update to `docs/adr/0009-safety-classifier-v0.md` (one section: "soft-flag from self-assessment"). No new ADR.

---

## Why this exists

PRD §4.5 makes it a product principle: "escalation is a first-class feature." PRD §6.8 lists the full Help & Safety surface and explicitly says "always linked from the top nav, never buried." Sprint 1 shipped only the persistent crisis strip and a `/help` route stub. This task ships the actual screen.

The screen has two halves:

1. **Reference content** — phone numbers, when-to-call checklists, all the directly-actionable resources from §6.8. Static content, but laid out so a tired person on a 3am phone screen can find the right number in under five seconds.
2. **Caregiver-burnout self-assessment** — a short scored questionnaire (existing validated instruments shorten to 5–7 questions for v0). Result is private to the user. **A high score writes a soft-flag row** (PRD §10.4 — yellow flag, not a crisis trigger) into the safety log so the home screen check-in card surfaces more often, per §10.4's "multiple yellow flags in a week elevate the home-screen check-in card" rule.

This task does not build the multiple-yellow-flag elevation logic on the home screen — that's TASK-024. It only emits the signal so TASK-024 can read it.

---

## Context to read first

1. `prd.md` §6.8 (the full screen list), §10.3 (escalation flow language to mirror), §10.4 (soft-flag pattern — this is where the self-assessment lands).
2. `apps/web/src/app/help/page.tsx` — the existing stub.
3. `apps/web/src/components/CrisisStrip.tsx` — the persistent strip stays as-is; do not duplicate its content into the page body.
4. `packages/safety/src/types.ts` — the existing flag shape; you'll write a soft flag through it.
5. `packages/db/src/schema/safety-flags.ts` — soft flags use this same table; the distinction is the severity field (`low`).
6. The Caregiver Self-Assessment Questionnaire (CSAQ) from the American Medical Association is the model; we're not licensing it — we're using a 7-question variant phrased in our own voice. Final wording PM will sign off.

---

## What "done" looks like

### Screen layout (`/help`)

Top of page: "Help & Safety." Below it, three blocks, in this order:

#### 1. Right now

A bold band with the §6.8 immediate resources, formatted as tap-to-call links on mobile:

- **Alzheimer's Association 24/7 Helpline** — 800-272-3900 (`tel:+18002723900`)
- **988 Suicide & Crisis Lifeline** — call or text 988
- **Crisis Text Line** — text HOME to 741741
- **Adult Protective Services** — link to `https://www.napsa-now.org/get-help/help-in-your-area/` (state finder)

Each as a card with the agency name, the number, what it's for in one short line, and a `tel:` / `sms:` / external link.

#### 2. Checklists

Two side-by-side panels (stacked on mobile):
- **When to call the doctor.** A 6–8 bullet list pulled from PRD §6.8. Each bullet plain English ("New confusion that came on suddenly," "Falls or new injuries"). Short.
- **When to call 911.** A 4–6 bullet list ("Trouble breathing or breathing very slowly," "Possible stroke signs," "Severe injury or bleeding," "She's not responding").

Copy comes from a small typed table at `apps/web/src/lib/help/checklists.ts` — the PM can edit it in one place.

#### 3. Caregiver burnout self-assessment

A "Take the burnout self-check" card. Tapping opens `/help/burnout-check`.

#### 4. Footer

- "Product support" — `mailto:` placeholder; copy says "Email us at support@hypercare.app." (Domain TBD; placeholder is fine for v0.)
- "About this product" — link to `/about` (stub page, "coming soon" — out of scope).

### Burnout self-assessment flow (`/help/burnout-check`)

- Single page, 7 questions, 5-point Likert ("never" → "every day" or similar — match the question wording).
- The 7 questions (PM draft — Caregiver-Support Clinician will refine in sprint 3):
  1. In the past two weeks, how often have you felt overwhelmed by caregiving?
  2. How often have you slept less than 6 hours because of caregiving?
  3. How often have you snapped at the person you care for and felt bad about it?
  4. How often have you skipped your own meals, medication, or appointments?
  5. How often have you felt like you can't do this anymore?
  6. How often have you cried about caregiving in private?
  7. How often have you felt isolated from friends or other family?

  Score 0–4 per item; total 0–28.

- On submit:
  - **Score < 8** — green card: "You're carrying a lot, and it sounds like you've got enough in the tank for now. Here's what to keep an eye on:" + one short paragraph + a "Take it again in two weeks" hint.
  - **Score 8–14** — amber card: "Caregiver burnout is a real thing, and you're showing some signs of it. A few things that help…" + 3 short concrete actions (link to relevant modules — for v0, link to the seeded self-care module if one exists; otherwise skip the link gracefully).
  - **Score 15+** — red card: "What you're describing is severe burnout. You don't have to wait until something breaks. Please consider reaching out to one of these:" + the §6.8 resources (Alzheimer's helpline, 988) inline. **Also: write a soft flag** (severity `low`, category `self_care_burnout`, source `burnout_self_assessment`) into `safety_flags` for this user.
  - **Score 22+** — same red card **plus**: write a `medium`-severity flag (still soft — does not trigger triage UI) and surface a small additional CTA: "If you're having thoughts of harming yourself or the person you care for, call 988 now." (Do not surface this CTA at lower scores — it patronizes.)
- The score itself is not stored beyond the flag write — we don't keep a longitudinal psychometric record in v0. ADR addendum should note this.

### Safety log writes

- Soft flags use the **existing** `safety_flags` table (from TASK-010).
- New `category` value: `self_care_burnout` — add to the CHECK constraint via a small migration in this ticket (one-line addition; the only schema change in this task).
- New `source` value: `burnout_self_assessment` — same CHECK constraint extension.
- The flag's `triaged` boolean is **false** (soft flag, not a crisis triage). The home-screen elevation logic (TASK-024) reads recent `safety_flags` for the user and decides to surface the check-in card more aggressively when count > 1 in the past 7 days.

### Tests

- Unit: scoring helper at `apps/web/src/lib/help/burnout-score.ts` — given an array of 7 ints, returns `{ score, band }` where band is `'green' | 'amber' | 'red' | 'red_severe'`. Test the boundaries (7, 8, 14, 15, 21, 22, 28).
- Unit: route handler `apps/web/src/app/api/app/help/burnout/route.ts` — given a green payload, no flag write; amber, no flag write; red, one flag write at severity `low`; red-severe, one flag write at severity `medium`. Mock the DB at the module boundary.
- Playwright E2E (`apps/web/test/e2e/help.spec.ts`):
  1. Log in, open `/help`, see the four blocks, tap-to-call link present on the helpline.
  2. Open `/help/burnout-check`, answer all 4s (max), submit, see the red-severe card, then check `safety_flags` for the medium-severity row.

### Telephony links

`tel:` and `sms:` are valid hrefs and Next handles them as standard anchors. Do not over-engineer this; use plain `<a href="tel:...">`.

### Accessibility

- Everything keyboard-navigable.
- The "Right now" cards must have ≥ 3:1 contrast for the phone numbers.
- The burnout questionnaire labels are real `<label>` elements with `for` attributes.
- No color-only distinction between green/amber/red — use icons + text labels too.

---

## Acceptance criteria

- `pnpm --filter web typecheck lint test` green; `pnpm --filter web build` green.
- `/help` renders the four blocks per PRD §6.8.
- Tap-to-call links work on a mobile viewport (manual: open in iOS Simulator or Chrome DevTools mobile mode and confirm the dial sheet opens).
- `/help/burnout-check` renders 7 questions, scores correctly (covered by unit), and the four bands produce the right cards (covered by Playwright + unit).
- `safety_flags` migration adds `self_care_burnout` to the `category` CHECK constraint and `burnout_self_assessment` to the `source` CHECK constraint, idempotently.
- A red-severe submission writes one `medium`-severity, non-triaged `safety_flags` row.
- The soft flag is **not** a triage event — no CrisisStrip pulse, no triage card, no redirect.
- Top-nav link from the authed layout to `/help` is present (was missing in sprint 1; if it's there, leave it; if not, add it).
- ADR 0009 addendum documents the new soft-flag source.

---

## Files to create / modify

### Create

```
apps/web/src/app/help/page.tsx                            # replace stub
apps/web/src/app/help/burnout-check/page.tsx
apps/web/src/app/api/app/help/burnout/route.ts
apps/web/src/components/help/RightNowCards.tsx
apps/web/src/components/help/Checklist.tsx
apps/web/src/components/help/BurnoutQuestionnaire.tsx
apps/web/src/components/help/BurnoutResultCard.tsx
apps/web/src/lib/help/checklists.ts                       # the two checklists (typed)
apps/web/src/lib/help/burnout-questions.ts                # the 7 questions + likert labels
apps/web/src/lib/help/burnout-score.ts                    # scoring helper
packages/db/migrations/NNNN_safety_flags_burnout_source.sql
apps/web/test/e2e/help.spec.ts
```

### Modify

```
apps/web/src/app/(authed)/layout.tsx                      # add /help link to nav if absent
docs/adr/0009-safety-classifier-v0.md                     # short addendum: burnout self-assessment soft flag
packages/safety/src/types.ts                              # extend Category + Source unions
packages/db/src/schema/safety-flags.ts                    # mirror the CHECK additions
TASKS.md
```

### Do **not** touch

- The CrisisStrip component itself.
- Existing safety classifier internals (`packages/safety/src/classify.ts` etc).
- Any RAG package.
- Any of TASK-019's new tables.

---

## Out of scope

- The home-screen elevation logic that consumes the soft-flag count — that's in TASK-024.
- Writing the burnout result history into a new table — we don't store the score over time in v0.
- Localizing the burnout questions (Spanish is post-v1).
- Building an admin view of soft-flag counts.
- The `/about` page beyond a stub.
- Booking real expert review of the question wording — that's a content-team / Caregiver-Support Clinician deliverable in sprint 3. PM owns "ship the v0 wording, mark it as v0 in the ADR addendum."

---

## Decisions to make in the PR

- **Whether `safety_flags` schema changes go in this ticket or in TASK-019.** They could go in TASK-019 alongside the other schema work. I put them here because they're tightly scoped to this feature and dragging them into TASK-019 makes that ticket harder to review. Keep them here.
- **Result-card copy for the four bands.** Drafts above are fine; tighten if you can without going clinical.
- **Whether to expose the score to the user.** My take: **yes**, show "X out of 28" — it grounds the band in something concrete and gives the user a feel for movement when they retake. Confirm in the PR.

---

## Questions for PM before starting

1. The 7 questions above — sign off as v0, or want me to swap any? My vote: ship as v0, mark in ADR, plan the clinician pass for sprint 3.
2. Domain for `support@…` — placeholder fine? Yes, `support@hypercare.app` placeholder, no real inbox required for v0.
3. Should the burnout result page offer a "share with my doctor" export? My vote: no, out of scope; v0 is private to the user, no PDF export.

---

## How PM verifies

1. Local dev, log in, click "Help" in nav. Land on `/help`.
2. On a mobile viewport, tap the Alzheimer's Helpline card — dial sheet opens.
3. Click "Take the burnout self-check," answer all 4s, submit. See the red-severe card with the 988 CTA.
4. Open psql, query `select category, severity, source, triaged from safety_flags where user_id = …;` — see the new `self_care_burnout` row at `medium` severity, `triaged = false`.
5. Verify CrisisStrip did **not** pulse — this is a soft flag, not triage.
6. Read the ADR 0009 addendum.

---

## Report-back

- Branch + PR + acceptance checklist mirror.
- Screenshots: `/help`, `/help/burnout-check` mid-questionnaire, all four result cards.
- The migration SQL inline.
- Decisions you landed on (the three above).
- Any of the 7 question wordings you'd push back on for v0.
