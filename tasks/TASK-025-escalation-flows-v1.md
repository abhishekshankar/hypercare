# TASK-025 — Escalation flows v1: the 5 remaining PRD §10.3 categories, end-to-end

- **Owner:** Cursor
- **Depends on:** TASK-010 (safety classifier + Layer A/B pipeline + `safety_flags` table + caregiver-self-harm flow already wired), TASK-021 (Help & Safety surface + soft-flag integration)
- **Unblocks:** TASK-026 (red-team expansion uses these flows as ground truth), beta launch (PRD §10.3 is a launch gate)
- **Status:** pending
- **ADR:** `docs/adr/0015-escalation-scripts-and-suppression.md` (new — script format, versioning, suppression policy)

---

## Why this exists

PRD §10.3 names six categories and six pre-scripted escalation flows. Sprint 1 shipped the classifier (TASK-010) across all six categories, and wired the **caregiver-self-harm** flow end-to-end as the proof point. The other five are detected (rows land in `safety_flags`) but the UI response today falls back to the generic safety refusal. That is the right failure mode during the slice build. It is not acceptable for a real caregiver.

PRD §10.3 is explicit about the shape of each flow:

- **Care recipient in danger** — 911 first on medical-emergency cues; wandering instructions if that's the signal.
- **Elder abuse / caregiver breaking point** — particular care about shame, respite resources, APS framed as help-seeking.
- **Dangerous request** — refuse to discuss dosing / medication changes; redirect to the underlying behavior + call-the-doctor path.
- **Medical emergency disguised as question** — "call 911 now" first line, info can follow.
- **Financial / legal exploitation** — APS, NCEA, elder-law; name the pattern.

Each of these was written in PRD §10.3 by an adult clinician because the content matters at the sentence level. The app's job is to render those scripts faithfully, interpolate names where the PRD calls for it, and **suppress normal feature prompts for 24 hours after the two caregiver-distress flows** (self-harm, breaking point), which is a PRD §10.3 requirement already flagged for TASK-024 / TASK-025 boundary.

This ticket also introduces the discipline the PRD requires: scripts are **versioned, expert-signed, and re-reviewed quarterly.** We encode that in repo: a CI check that fails if a script body changes without bumping `reviewed_on`.

---

## Context to read first

1. `prd.md` §10 (read the whole section; §10.3 is the literal source material; §10.4 soft-flag elevation interacts with the suppression rule; §10.6 "what the product deliberately does not do" bounds the scope).
2. `packages/safety/src/scripts/` — today this has only `caregiver-self-harm.md`. Mirror that shape for the new five.
3. `packages/safety/src/classify.ts` — where `SafetyCategory` is defined. The category set is correct; do not add new categories.
4. `apps/web/src/components/safety/EscalationCard.tsx` (from TASK-010) — the render surface for caregiver-self-harm. Either generalize this component or add a sibling per category; decide in ADR 0015.
5. `packages/safety/src/rules/` — Layer A rules. Read what's there for each category before writing red-team queries in TASK-026; do not change rules in this ticket unless you find a real miss.
6. `docs/adr/0009-safety-classifier-v0.md` — the design the escalation flows sit on top of. This ticket does not change Layer A/B; it only changes what the pipeline **does** with a `triaged: true` result.
7. `packages/db/src/schema/safety-flags.ts` — the table. You'll add a `suppression_until` column to `users` or a new `user_suppression` table; decide in ADR 0015.

---

## What "done" looks like

### 1. Five new script files

Under `packages/safety/src/scripts/`, one file per category, in the same shape as `caregiver-self-harm.md`:

```
care-recipient-in-danger.md
elder-abuse-or-caregiver-breaking-point.md
dangerous-request.md
medical-emergency-disguised-as-question.md
financial-or-legal-exploitation.md
```

Each file has YAML frontmatter and markdown body:

```
---
category: care_recipient_in_danger
version: 1
reviewed_by: "Dr. [Name], [Credential]"        # placeholder PM will fill in
reviewed_on: 2026-04-22
next_review_due: 2026-07-22
severity_default: high
primary_resources:
  - { label: "Call 911", href: "tel:911", primary: true }
  - { label: "Alzheimer's Association 24/7 helpline: 800-272-3900", href: "tel:8002723900" }
---

# Care recipient in danger

## Direct answer (first two sentences — verbatim from PRD §10.3)
This sounds like it may need emergency medical attention. Please call 911 now if you haven't already.

## Then
[body copy drawn verbatim from PRD §10.3, with {{CR_NAME}} interpolation where appropriate]

## What we do NOT do
- Do not explain dosing.
- Do not diagnose.
- Do not engage with the specific medication / treatment question.

## Follow-up suppression
duration_hours: 0       # no suppression for this category
```

The body copy is drawn **verbatim from PRD §10.3** where the PRD is prescriptive (e.g. the "What you just shared takes real honesty..." pattern in elder-abuse). Do not improvise the clinical sentences. Where the PRD is generic ("then specific guidance"), write a short concrete paragraph and flag it in the PR for the Caregiver-Support Clinician's review.

**Placeholder reviewer names are fine for merge.** PM replaces them with real names before production rollout; this ticket ships the mechanism, not the signatures.

### 2. Per-flow UI rendering

The conversation surface (`apps/web/src/components/conversation/Thread.tsx` or wherever TASK-011 rendered the assistant turn) already branches on `refusal.code === "safety_triaged"`. Today it falls through to the generic refusal card. Update the branch so each of the six categories renders its own pre-scripted response:

- The **first two sentences** are the "Direct answer" from the script and are styled as primary action text (not body copy), because PRD §6.4 says the direct answer comes first and PRD §10.3 says the 911 instruction is the first line for the medical-emergency and CR-in-danger flows.
- **Primary resources** render as tappable buttons (phone numbers `tel:`, web URLs in a new tab). The "Talk to someone now" button for self-harm is 988; for care-recipient-in-danger it's 911. Buttons come from script frontmatter — do not hardcode per-category in the component.
- **Body copy** renders below the buttons as prose. Markdown; no freeform LLM generation.
- **No source-attribution footer** on escalation responses (unlike normal grounded answers). A small "This response is pre-written and reviewed by {{reviewer}} on {{reviewed_on}}." line at the bottom instead, for trust.
- **No "was this helpful?" thumbs** on escalation. (A thumbs-down on an escalation is noise; if the user wants to flag a miss, they use the `/help` → "contact support" path.)
- **The chat input remains enabled.** The user may ask follow-ups. Follow-up queries are classified normally; if they stay in the same crisis category, they re-render the same card without spamming a new `safety_flags` row (dedupe in the API route — one flag per category per conversation per 5-minute window).

One generalized component preferred over five near-duplicates. ADR 0015 records the decision.

### 3. Follow-up suppression for the two caregiver-distress flows

PRD §10.3 on caregiver self-harm: *"For the next 24 hours, suppress normal feature prompts ("This week's focus," daily lesson push) in favor of a persistent, gentle 'I'm here when you're ready.'"*

Apply the same rule to the **elder-abuse / caregiver-breaking-point** flow (same intent: the caregiver is in acute distress and pushing lesson content at them is wrong).

Implementation:

- Schema: add `suppression_until timestamptz` column to `users` (or a tiny `user_suppression(user_id, until, reason)` table; decide in ADR 0015 — my vote: new table because it keeps `users` thin and is queryable for the operator audit). Migration under `packages/db/migrations/`.
- On classify → `triaged: true` with category in `{caregiver_self_harm, elder_abuse_or_caregiver_breaking_point}`, set `suppression_until = now() + 24h`. Severity does not change the duration in v0.
- `/app` home screen reads `suppression_until`. If active:
  - Hide the "This week's focus" card.
  - Hide the weekly check-in card.
  - Render a single "I'm here when you're ready" card at the top, with the category's primary resources (helpline, 988 / Crisis Text Line, APS link for elder abuse). Copy from `packages/safety/src/scripts/_suppression-home-card.md` (new shared file).
  - The ask-anything input and recent conversations stay visible.
- The suppression window is **honored, not extended**, if another flag of the same kind fires during it (pick the later of the two timestamps).
- On suppression expiry, next `/app` render restores normal cards. No sudden "welcome back!" banner.

### 4. Versioning + script-review CI check

The PRD requires quarterly re-review of the elder-abuse flow "personally, by the Caregiver-Support Clinician." Encode the discipline:

- `scripts/check-safety-scripts.ts` (new): reads every `packages/safety/src/scripts/*.md`, parses frontmatter, and asserts:
  - `reviewed_on` is a valid ISO date.
  - `next_review_due` is `reviewed_on + 90 days` or later (the 90-day minimum is set in the ADR).
  - `reviewed_by` is a non-empty string.
  - Body hash is recorded in `packages/safety/src/scripts/.review-manifest.json` alongside `reviewed_on`. If the body changes without `reviewed_on` bumping, fail the check.
- Wire it into `pnpm --filter @hypercare/safety check:scripts` and into CI (`.github/workflows/ci.yml` adds it as a step).
- One-time: commit the manifest for all six scripts with today's `reviewed_on`.

A safety script change that bypasses the check (e.g. someone edits a script in the same PR that bumps `reviewed_on`) is expected — the check catches **silent edits**, not intentional ones. ADR 0015 records this.

### 5. Per-category dedupe for `safety_flags`

Today TASK-010 writes a `safety_flags` row on every classified message. That produces noise when a caregiver has a 6-turn conversation inside a single crisis — they get 6 rows of the same category. Dedupe:

- On write, check if a row exists for `(user_id, conversation_id, category)` with `created_at > now() - interval '5 minutes'`. If so, increment a new `repeat_count int not null default 0` column instead of inserting a new row.
- The first row is always written; subsequent same-category turns within 5 minutes update `repeat_count += 1` and `last_message_text` (the latest turn, for reviewer context). Original `message_text` stays.
- Migration: `add column repeat_count int, last_message_text text`.
- The weekly-review Content Lead audit (PRD §10.2 end) reads the dedup'd rows; PM confirms this is what they want in the ADR discussion.

### 6. Mandatory-reporter disclosure text

PRD §14 open question: state-by-state mandatory-reporter analysis for elder-abuse. This is **not a legal ticket**, but the product must not overpromise confidentiality. In the elder-abuse script, include the PRD §10.6 line verbatim: *"We don't promise confidentiality we can't keep. Depending on your state, some conversations about abuse may be reportable. This is a place to get help — it's not a place to report yourself."* (exact wording above is my draft; if the PRD has stricter language, use it.) Flag this line in the PR for PM review — legal counsel will revisit pre-launch, but we ship the placeholder now.

---

## API / persistence changes

```
packages/db/migrations/00NN_user_suppression_and_flag_dedupe.sql
  CREATE TABLE user_suppression (
    user_id uuid primary key references users(id),
    until timestamptz not null,
    reason text not null check (reason in ('caregiver_self_harm','elder_abuse_or_caregiver_breaking_point')),
    set_at timestamptz not null default now()
  );
  ALTER TABLE safety_flags
    ADD COLUMN conversation_id uuid references conversations(id),
    ADD COLUMN repeat_count int not null default 0,
    ADD COLUMN last_message_text text,
    ADD COLUMN script_version int;    -- which version of the script was rendered
```

(Decide in ADR whether `conversation_id` belongs on `safety_flags` as a new column — my vote yes; it makes dedupe trivial and gives reviewers a click-through path.)

```
GET  /api/app/suppression/status     → { active: boolean, until?: ISOString, reason?: string }
```

Home screen calls this server-side during render. No client fetch.

The conversation response API (`/api/app/conversation/[id]/message` from TASK-011) already returns `refusal` payloads; extend the payload shape:

```ts
type SafetyRefusal = {
  code: "safety_triaged";
  category: SafetyCategory;
  script: {
    version: number;
    reviewed_by: string;
    reviewed_on: string;             // ISO date
    direct_answer: string;
    body_md: string;
    primary_resources: Array<{ label: string; href: string; primary?: boolean }>;
    disclosure?: string;             // present on elder-abuse flow only
  };
  repeat_in_window: boolean;         // true if this was a dedupe'd repeat
};
```

The API route renders the script server-side from the .md file (not the client) — keeps the script source out of the client bundle, matches ADR 0010's import boundary.

---

## Tests

- Unit (`packages/safety/test/scripts.test.ts`):
  - Every script file parses, has the required frontmatter, has a non-empty direct answer.
  - The CI check fails when a body byte changes without `reviewed_on` bumping. (Simulate by shelling in a mutation in a `beforeEach`.)
- Unit (`packages/safety/test/dedupe.test.ts`):
  - Same category + same conversation + within 5 min → increments `repeat_count`.
  - Different conversation → new row.
  - Different category → new row.
  - Outside 5 min → new row.
- Unit (`apps/web/test/safety/suppression.test.ts`):
  - After caregiver-self-harm flag → `suppression_until = now + 24h`.
  - After elder-abuse flag → same.
  - After dangerous-request flag → no suppression.
  - Second self-harm flag 2h into window → `until` stays at the later of the two.
  - Home page with active suppression → no `WeeksFocusCard`, no `CheckinCard`, one `SuppressionCard` visible.
- Integration (`apps/web/test/api/conversation-escalation.test.ts`):
  - POST a care-recipient-in-danger-shaped message → response has `refusal.code === 'safety_triaged'`, `refusal.category === 'care_recipient_in_danger'`, `script.direct_answer` starts with "This sounds like it may need emergency medical attention."
  - Same for the other four categories.
- E2E (`apps/web/test/e2e/escalation-flows.spec.ts`):
  1. Log in. Send a medical-emergency message ("she fell and hit her head and she's not responding"). Expect the 911 card, tap the 911 button (Playwright asserts the `tel:` href — does not dial).
  2. Send an elder-abuse self-admission message. Expect the breaking-point card, expect the disclosure line, expect the APS link.
  3. Reload `/app`. Expect the "I'm here when you're ready" suppression card, no focus card, no check-in.
  4. Fast-forward 25h (test-only time shim). Reload. Expect normal `/app`.

---

## Acceptance criteria

- Five new script .md files checked in with frontmatter + body; all six (incl. caregiver-self-harm) pass `check:scripts`.
- Conversation surface renders the correct per-category card for every PRD §10.3 category. The self-harm card is visually consistent with the new cards (generalize the component).
- `safety_flags` rows carry `conversation_id`, `script_version`, `repeat_count`, and a 5-min same-category dedupe.
- `user_suppression` populated after caregiver-self-harm or elder-abuse flags; home screen respects it for 24h; expires cleanly.
- The CI `check:scripts` step fails on a silent body edit; passes on a body edit with matching `reviewed_on` bump.
- PRD §10.6 disclosure sentence appears in the elder-abuse script.
- ADR 0015 written: script format, versioning/review discipline, suppression table vs column decision, dedupe-window rationale.
- `pnpm lint typecheck test` green; `EVAL_LIVE=1 pnpm --filter @hypercare/eval start -- answers` does not regress; `EVAL_LIVE=1 pnpm --filter @hypercare/eval start -- safety` (TASK-010's existing mode) reports the 5 new categories with correct flow rendering at ≥ 90% for the seeded queries that hit them.

---

## Out of scope

- **Adding new categories.** PRD §10.1 defines six; we keep six.
- **Changing Layer A rules or Layer B prompts.** If you find a real miss in scripting the flows, **report in the PR** and cut a follow-up ticket. Do not silently widen the rules.
- **A fine-tuned classifier.** TASK-026 collects labeled examples; a fine-tune is a post-beta ticket.
- **Legal review of the disclosure sentence.** The placeholder ships; legal iterates pre-launch.
- **Reporter-agnostic workflows** (i.e. "report to APS on behalf of the user"). Hypercare does not report; it points the user to APS.
- **Localized (non-US) crisis resources.** v1 is US-only. ADR 0015 notes the i18n shape the script format allows for.
- **Push notifications during suppression windows** — suppression is in-app only. (Matches the sprint-2 decision.)

---

## Decisions to make in the PR

- **One component with a discriminated-union `category`, or five sibling components?** My vote: one component, since the structural shape (direct answer → primary resources → body → disclosure? → footer) is identical. Document in ADR.
- **`suppression_until` column on `users` vs a new `user_suppression` table.** My vote: new table (see above).
- **5-minute dedupe window.** Sign off on 5 min, or want longer (15 / 30)? Longer makes the operator log cleaner; shorter is more conservative for distinct-crisis detection.
- **Whether the ask-anything input stays enabled during an active suppression window.** My vote: yes — we don't want to feel like a locked-out support surface. The user can still ask anything, we just don't push content at them.

---

## Questions for PM before starting

1. **Severity mapping.** Today TASK-010 classifier returns `{low, medium, high, emergency}`. Do we want per-severity branching **within** a category (e.g. medium elder-abuse concern = no suppression, high = suppression), or is every `triaged: true` in the two distress categories a suppression? **PM note:** keep it simple for v1 — any triage in those two categories triggers suppression. Re-evaluate after the red-team set (TASK-026) is in and we see false-positive rates.
2. **The elder-abuse disclosure sentence.** Use the PRD's wording if you find it; otherwise ship the draft above and flag the line for the clinician review in sprint 4.
3. **`safety_flags.conversation_id` backfill.** Old rows from sprint 1 have no conversation. Backfill `NULL`, and update the operator-audit query to tolerate it.
4. **Do you want a `/internal/safety-flags` review surface in this ticket, or is that TASK-029's metrics surface?** My vote: TASK-029. Keep this one focused on the user-facing flows.

---

## How PM verifies

1. `pnpm --filter @hypercare/safety check:scripts` — green.
2. Mutate one script body without bumping `reviewed_on` → `check:scripts` fails. Revert.
3. Log in as a seeded user. For each of the 5 new categories, post a representative message and eyeball the rendered card.
4. After the self-harm or elder-abuse card, `/app` renders the suppression surface. `psql -c "select * from user_suppression where user_id = '…';"` shows a row.
5. Send 3 in-category messages in 90 seconds → `psql -c "select category, repeat_count from safety_flags where user_id = '…' order by created_at desc limit 3;"` — one row with `repeat_count = 2`.
6. Read ADR 0015.

---

## Report-back

Standard PROJECT_BRIEF §7 format, plus:

- Screenshots of each of the 5 new escalation cards at 375px width.
- A table of the 6 scripts with `reviewed_on` and `next_review_due`.
- The PR body calls out the placeholder-reviewer-name lines for PM to replace.
- Any red-team query you ran that did **not** fire the expected category — we want that as input to TASK-026, not a silent over-tune of the rules.
