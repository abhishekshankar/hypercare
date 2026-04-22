# TASK-034 — Onboarding stage-assessment question refinement v1

- **Owner:** Cursor (implementation); PM + Care Specialist (question wording + sign-off); lived-experience reviewers (validation study)
- **Depends on:** TASK-005 (onboarding scaffold), TASK-007 (onboarding writes), and TASK-020 (editable profile — the new wording has to land there too)
- **Unblocks:** a more accurate inferred stage (which every personalization surface keys off), PRD §14 open-question resolution, the PRD §5.2 requirement that the 8 questions be "validated with the Care Specialist and 5–10 caregivers before they're built"
- **Status:** in progress (implementation landed; PM sign-off + validation notes still required for merge)
- **ADR:** `docs/adr/0023-onboarding-stage-questions-v1.md` (new — final question wording, rationale, stage-inference rule deltas, back-compat migration)

---

## Why this exists

PRD §5.2 lists 6–8 behavioral questions to infer stage without exposing clinical jargon to the caregiver. Sprint 2 shipped the PRD's draft wording — the product works end-to-end against it. But the PRD §14 open question is explicit: *"The exact eight behavioral questions for the stage inference (§5.2) need validation with the Care Specialist and 5–10 caregivers before they're built."* The closed-beta cohort gives us access to those caregivers and the Care Specialist has now signed off on a refined set.

This ticket lands the refined wording, reruns the inference over existing users' stored answers, and ensures the beta cohort's answers (captured under the draft wording) map cleanly to the new set. It is a surgical content + data-migration ticket, not a new feature.

---

## Context to read first

1. `prd.md` §5.2 (the 8 questions as PRD draft), §14 (open question flagging the need for refinement).
2. `packages/content/stage-rules/` or wherever TASK-007 put the inference rules — `docs/adr/0005-onboarding-stage-rules.md` is the source.
3. `apps/web/src/app/onboarding/` — the multi-step onboarding surface.
4. `apps/web/src/app/(authed)/app/profile/` — where the same questions appear in edit mode.
5. `packages/db/src/schema/care-profile.ts` — the columns the answers write to.
6. The Care Specialist's signed markdown: `docs/content/stage-questions-v1.md` (PM drops this file into the repo before the ticket starts; wording below is Cursor's placeholder until the real file lands).

---

## What "done" looks like

### 1. The refined 8 questions (placeholder — replace with the signed version)

Until the Care Specialist ships the final wording, plan for **up to 8** questions with the shape below. The sprint-2 draft asked these (paraphrased):

| # | Sprint-2 (draft)                                                  | Sprint-4 (expected signed wording, placeholder)                                                                            |
|---|-------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| 1 | Can [name] manage their own medications?                          | *Does [name] need help remembering or taking their medications?* (yes/no/sometimes)                                         |
| 2 | Does [name] still drive?                                          | *Is [name] still driving?* (yes — safely / yes but I'm worried / no — stopped within the last year / no — stopped ago)      |
| 3 | Can [name] be left alone safely for a few hours?                  | *If you left [name] alone for a few hours, what would you worry about?* (multi-select: nothing / wandering / cooking …)     |
| 4 | Does [name] recognize you most of the time?                       | *When you see [name], do they know who you are?* (yes always / yes usually / sometimes / rarely)                             |
| 5 | Can [name] bathe and dress without help?                          | *How does [name] manage bathing and dressing?* (on their own / with reminders / needs hands-on help)                         |
| 6 | Has [name] had incidents of getting lost or wandering?            | *Has [name] gotten lost or wandered in the last year?* (no / once / a few times / often)                                    |
| 7 | Does [name] carry on conversations that make sense to you?        | *Can [name] have a conversation that makes sense to you?* (yes / yes but repeats / only short / rarely makes sense)          |
| 8 | Does [name] sleep through the night usually?                      | *How are [name]'s nights — do they sleep through, or are nights hard?* (sleep through / some nights hard / most nights hard) |

(Exact wording replaced from `docs/content/stage-questions-v1.md` when PM drops it.)

The answer shapes change — several questions move from binary yes/no to 3–4 ordinal levels. This is the migration.

### 2. Schema

New columns on `care_profile` for the ordinal answers (do not alter the existing boolean columns — keep them for back-compat, and mark them deprecated in the schema doc):

```
ALTER TABLE care_profile
  ADD COLUMN med_management_v1 text check (med_management_v1 in ('self','reminders','hands_on_help') or null),
  ADD COLUMN driving_v1        text check (driving_v1 in ('safe','worried','stopped_recent','stopped_long_ago','never_drove') or null),
  ADD COLUMN alone_safety_v1   text[],        -- multi-select
  ADD COLUMN recognition_v1    text check (... ),
  ADD COLUMN bathing_dressing_v1 text check (...),
  ADD COLUMN wandering_v1      text check (...),
  ADD COLUMN conversation_v1   text check (...),
  ADD COLUMN sleep_v1          text check (...),
  ADD COLUMN stage_questions_version int not null default 1;
```

`stage_questions_version` marks which set of questions the answers reflect. v0 existing rows are `0`; v1 rows are `1`.

Migration under `packages/db/migrations/`. Document in `docs/schema-v1.md`.

### 3. Back-compat migration of existing answers

A one-shot migration (`packages/content/src/scripts/migrate-stage-v1.ts`):

- For each `care_profile` row with `stage_questions_version = 0`:
  - Read the boolean/legacy answer.
  - Apply a **deterministic mapping** (defined per-question in the script; reviewed in ADR 0023) to a v1 ordinal value.
  - Example: legacy `medications_managed_self = true` → `med_management_v1 = 'self'`; `false` → `'reminders'` (conservative — we don't know if hands-on help was needed); null → null.
- Recompute inferred stage using the v1 rules and compare against the stored inferred stage.
- Report:
  - How many rows flipped stage (e.g., middle → early). Expected: < 5%. If > 10%, stop and route to the Care Specialist — the rules need adjusting, not the data.
  - Per-question distribution pre- and post-migration.
- Dry-run by default; `--commit` to write.

### 4. Stage-inference rules v1

The rules in `packages/content/stage-rules/` (or wherever ADR 0005 put them) are updated to read the v1 columns. Document the per-question weights and the threshold bands in ADR 0023.

Keep the rules **behaviorally additive** for a migration window: during deploy, the inference function reads either v0 or v1 columns depending on `stage_questions_version`. After the migration script commits everyone to v1, the v0 path is removed in sprint 5.

### 5. Onboarding UI

Six changes:

1. The question text in each onboarding step is replaced. (Wording lives in `apps/web/src/app/onboarding/questions-v1.ts`.)
2. Ordinal questions swap `<select>` or radio groups for 3–4 options.
3. Question 3 (alone-safety) becomes a checkbox multi-select with the chip pattern from TASK-020.
4. The progress indicator updates if the question count changes.
5. Micro-copy ("You can change any of this later") unchanged.
6. The summary screen at the end of onboarding reflects v1 phrasings ("Margaret needs reminders with her medications" instead of "Margaret doesn't manage medications on her own").

### 6. Profile-edit UI

Same six changes on the editable-profile surface (TASK-020). No divergence between onboarding and edit — both read `questions-v1.ts`.

Existing in-flight onboardings (rare — a user started but didn't finish) are migrated at the next step: partial answers stored under v0 are replayed through the back-compat mapping on first v1 render.

### 7. Validation study artifacts

The PRD asks the questions to be validated against 5–10 caregivers. The study is not engineering work, but the artifacts live in repo:

- `docs/content/stage-questions-v1.md` — the signed question set + rationale per question (PM + Care Specialist own this file).
- `docs/content/stage-questions-validation.md` — notes from the 5–10 caregiver sessions, redacted. Who, when, what they said, what was changed.

Engineering reads these; does not author them.

---

## Tests

- Unit (`packages/content/test/stage-rules-v1.test.ts`): deterministic input → deterministic stage; a fixture table of 20 representative answer sets with expected stages (derived by the Care Specialist; checked in).
- Unit (`packages/db/test/migrate-stage-v1.test.ts`): for a seeded v0 row, migration produces the expected v1 columns and the inferred stage matches within the stability band.
- Integration (`apps/web/test/onboarding/flow.test.ts`): new wording renders; all 8 questions answerable; summary reflects v1 phrasings.
- Integration (`apps/web/test/profile/edit-v1.test.ts`): v1 answers round-trip through save / reload.
- E2E (`apps/web/test/e2e/onboarding-v1.spec.ts`): complete onboarding with v1 questions; confirm `stage_questions_version = 1` in DB.
- Data test (`pnpm --filter @hypercare/content migrate:stage-v1 --dry-run`): on the seeded beta fixture, report the migration summary; the "stage flipped" count is < 5%.

---

## Acceptance criteria

- v1 questions live in `apps/web/src/app/onboarding/questions-v1.ts` and in the profile editor; both surfaces read the same source.
- Schema v1 columns shipped; CHECK constraints enforce the allowed values.
- Back-compat migration script runs cleanly on the seeded beta fixture; dry-run summary attached to the PR.
- Stage-inference rules updated; the 20-fixture stage-determinism test passes.
- `docs/content/stage-questions-v1.md` present, Care Specialist-signed (sign-off linked in the PR description).
- Validation notes (`docs/content/stage-questions-validation.md`) present, redacted.
- ADR 0023 written.
- `pnpm lint typecheck test` green; eval doesn't regress.

---

## Out of scope

- Non-English wording. The v1 strings live in a single `questions-v1.ts` file structured so i18n can be added later; no translation in this ticket.
- Expanding to 12 questions or adding a DASS / GDS-style clinical instrument. v1 stays at 6–8 behaviorally-phrased questions.
- A/B testing different wordings. One version, signed, ships.
- A "re-take the stage questions" button on the profile page. Edit individual answers only.
- Changes to the stage labels shown to the user (early / middle / late). Same labels.
- Re-validation after every module-library expansion. The questions are stable.

---

## Decisions to make in the PR

- **Deprecate or drop v0 columns.** Keep for a sprint; drop in sprint 5 after a reindex. My vote: keep, mark deprecated in `docs/schema-v1.md`.
- **Migration strategy for in-flight onboardings.** Replay through the mapping on first v1 render (my vote) vs force-restart the onboarding. Replay is kinder to the few affected users.
- **Multi-select question 3.** Ship as chips (TASK-020 pattern) vs standard checkboxes. My vote: chips; matches existing design.
- **What "alone safety" maps to in the stage rule.** The sprint-2 rule was a binary. The v1 multi-select is richer. Does "wandering" count more heavily than "cooking"? Care Specialist provides the weights in ADR 0023.

---

## Questions for PM before starting

1. **`docs/content/stage-questions-v1.md`** — when does this land? I'll start the ticket even if it's draft; the file format is ready. Pin the final wording before PR merge.
2. **Validation study recruits.** 5–10 caregivers from the closed beta cohort; who recruits and when? Non-blocking for code; blocking for ADR 0023 completeness.
3. **Stage-flip tolerance.** I set < 5% expected / > 10% a stop-and-review threshold. Sign off, or tighter?
4. **The deprecated v0 columns.** When do we actually drop them — sprint 5 or sprint 6? Document the sunset date in the schema doc.

---

## How PM verifies

1. Start onboarding as a new user. See v1 wording for all 8 questions. Complete.
2. `psql -c "select stage_questions_version, med_management_v1, bathing_dressing_v1 from care_profile where user_id = '…';"` — `1` and the expected answers.
3. `/app/profile` — the same 8 questions with the same wording, current answers pre-populated.
4. Edit one answer (e.g., bathing from `self` → `reminders`). Save. The inferred stage updates; the change-log has an entry.
5. Run `pnpm --filter @hypercare/content migrate:stage-v1 --dry-run` against the seeded fixture → report shows < 5% stage flips.
6. Open `docs/content/stage-questions-v1.md` — signed, rationale per question present.
7. Read ADR 0023.
