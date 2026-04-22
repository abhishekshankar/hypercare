# TASK-037 — Spaced-repetition scheduling for "this week's focus"

- **Owner:** Cursor
- **Depends on:** TASK-019 (`lesson_progress` schema — `started_at`, `completed_at`, `revisit` columns are the source of truth this filter reads), TASK-024 (the picker policy in `@hypercare/picker`; we layer on top, do not replace), TASK-027 (conversation memory — surfaces a "topic recurrence" signal that informs `revisit`)
- **Unblocks:** PRD §1.3 deferral of SRS; the Sprint 4 cohort complaint that "she keeps showing me the same lesson"; future "remind me when this is due" notification channels (out of scope here, but the schedule rows are what they will read)
- **Status:** in progress (core shipped; see gaps below)
- **ADR:** `docs/adr/0026-srs-scheduling-policy.md` (new — algorithm choice, schedule semantics, interaction with the existing picker)

---

## Why this exists

PRD §1.3 deferred spaced repetition at v1 with a clear rationale: we hadn't proven the lesson loop, so optimizing the *timing* of repeat lessons was premature. Sprint 2 built the loop (TASK-024 picker + lesson surface), Sprint 3 wired conversation memory into the picker signal (TASK-027), and Sprint 4 ran the closed beta. The cohort told us two things in feedback (TASK-036 thumbs-down rows + free-text on `/app/help`):

1. **Re-surface fatigue.** ~18% of cohort caregivers in week 3+ flagged that "this week's focus" repeated a lesson they'd already done within the last 5 days. Today the picker has a soft 14-day cooldown but it's expressed as a tiebreaker, not a hard filter, and it loses to "stage match" + "recent topic" most weeks for users with sparse stage/topic signal.
2. **No way to ask for a re-read.** Several caregivers said the opposite: a lesson on bathing-resistance helped, and they want it back in 2 weeks "to remind myself." Today they screenshot it. The `lesson_progress.revisit` boolean was added in TASK-019 anticipating this and is currently unused.

SRS solves both. Re-surface fatigue → spacing schedule says "don't show this lesson again until N days have passed unless the user asked." Re-read demand → `revisit: true` opts a lesson into a faster review cadence, deliberately re-surfacing it.

This is **not** Anki for caregivers. The unit being scheduled is a 5-minute lesson card, not a vocabulary item, and the user is not flashcard-grading themselves. The algorithm needs to be simple enough that the next maintainer can defend each schedule choice from the table by hand.

---

## Context to read first

1. `prd.md` §1.3 (the SRS deferral and the v2 framing), §3.1 (helpfulness + retention; SRS is a retention lever), §6.5 (lesson surface contract).
2. `packages/picker/src/index.ts` — the existing picker. Read the scoring loop end-to-end. SRS is a **pre-filter**, not a re-score.
3. `docs/adr/0014-weeks-focus-picker-and-lesson-surface.md` — the policy ADR. ADR 0026 should reference this and state explicitly what stays and what changes.
4. `docs/schema-v1.md` — the `lesson_progress` table contract. New table `lesson_review_schedule` is added in TASK-043 but defined here.
5. TASK-019 ticket — for the original `revisit` rationale.
6. TASK-036 — the feedback rows that motivated this; the queue at `/internal/feedback` will show the pre-Sprint-5 complaints once we ship and want them marked resolved.

---

## What "done" looks like

### 1. Schedule table

A new table `lesson_review_schedule`:

```
lesson_review_schedule (
  id              uuid pk,
  user_id         uuid fk users (not null),
  module_id       text fk modules (not null),
  -- the schedule
  bucket          int not null,            -- 0..5; see §2 below
  due_at          timestamptz not null,    -- the earliest moment this lesson can resurface
  last_seen_at    timestamptz not null,
  last_outcome    text not null,           -- 'completed' | 'started_not_completed' | 'revisit_requested'
  -- bookkeeping
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, module_id)
)
```

One row per (user, module) the user has interacted with. Inserted on first lesson start; updated on each subsequent completion / revisit toggle.

### 2. Algorithm: SM-2-lite

The five themes Sprint 5 promised "scheduling," not "an algorithm," so keep this defensible. SM-2-lite means:

- Buckets 0..5 with fixed intervals: `[1d, 3d, 7d, 14d, 30d, 60d]`.
- New lesson started: insert row with `bucket=0, due_at = now + 1d, last_outcome='started_not_completed'`.
- Lesson completed: `bucket = min(prev_bucket + 1, 5); due_at = now + interval(bucket); last_outcome='completed'`.
- User toggles `revisit: true` on a completed lesson: `bucket = max(prev_bucket - 2, 1); due_at = now + interval(bucket); last_outcome='revisit_requested'`. Clamp to bucket 1 minimum so a revisit never schedules sooner than 3 days (avoid the picker re-surfacing the same lesson tomorrow because the user clicked "revisit" today).
- User toggles `revisit: false` on a completed lesson: no schedule change. The flag itself is what the picker reads to decide; the schedule reflects the last forward action.

The intervals live in `packages/picker/src/srs.ts` as exported constants. Changing them is one PR, one ADR amendment.

ADR 0026 records: SM-2-lite over Leitner because we want to honor "I asked to revisit this" as a meaningful signal, not just bucket arithmetic; over true SM-2 because we have no quality grade per lesson (the user isn't rating their own recall).

### 3. Picker integration

`@hypercare/picker` gains a pre-filter step:

- Before the existing scoring loop, fetch all `lesson_review_schedule` rows for the user.
- Mark each candidate module as `dueState: 'due' | 'not_yet_due' | 'never_seen'` based on its row (or absence).
- Drop `not_yet_due` from the candidate set unless the candidate set would otherwise be empty (graceful degradation: better a re-surface than a blank card).
- Continue with the existing scoring (stage match, recent-topic match, fallback). The pre-filter does not change relative ordering — it only narrows the input set.

`packages/picker/test/picker.test.ts` gains cases:

- User with no schedule rows → no filter applied → existing behavior preserved.
- User with a completed-yesterday module → that module is filtered out; picker selects from the remainder.
- User who marked `revisit: true` two weeks ago on a bucket-3 lesson → that lesson is `due` and re-enters the candidate set.
- All candidates `not_yet_due` → fallback returns the most-overdue (longest past `due_at`).

### 4. The "due for review" hint on the lesson surface

When the picker selects a module that has a prior `lesson_review_schedule` row with `last_outcome != 'started_not_completed'`, the lesson card shows a one-line transparency hint: *"Last seen 9 days ago — due for a quick review."* (Pattern matches TASK-033's "What Hypercare remembers" voice.)

When the user marks `revisit: true` on a lesson, a one-line ack: *"Got it — we'll bring this back around in about a week."* The "about a week" phrasing reads from the new schedule row's `due_at` and rounds to the nearest interval label (`tomorrow / a few days / about a week / a couple of weeks / about a month / about two months`).

### 5. Schedule writeback

- `lesson_started` event (already fired by TASK-024's lesson surface) → upsert schedule row with bucket 0.
- `lesson_completed` event → bump bucket per §2.
- `revisit` toggle → write per §2.

Writeback is synchronous in the same request that updates `lesson_progress`. Failure to write the schedule row is logged but does not fail the user-visible action; the picker degrades to existing behavior on the next pick.

### 6. Migration + backfill

Migration `0016_lesson_review_schedule.sql` creates the table (repo sequence; ticket originally said `0013`).

Backfill script `scripts/backfill-lesson-review-schedule.ts` walks existing `lesson_progress` rows and synthesizes a schedule row per (user, module) using the latest event:

- `completed_at not null` → bucket = `min(weeks_since_completion, 5)`; `last_outcome='completed'`.
- `started_at not null and completed_at null` → bucket 0; `last_outcome='started_not_completed'`.
- `revisit = true` → apply the revisit rule on top of the above.

Backfill is idempotent (the unique index on `(user_id, module_id)` handles re-runs). Running cost is small — beta cohort has ≤ 200 caregivers × ≤ 5 modules each.

---

## Tests

- Unit (`packages/picker/test/srs-filter.test.ts`): pre-filter narrows candidates correctly across `due / not_yet_due / never_seen` states; empty-result fallback returns the most-overdue module.
- Unit (`packages/picker/test/srs-bucket.test.ts`): the bucket arithmetic — completion bumps, revisit clamps to bucket 1, interval table is the source of truth.
- Integration (`packages/db/test/lesson-review-schedule.integration.test.ts` with `LRS_INTEGRATION=1` + `DATABASE_URL`): completing a lesson upserts a row; toggling revisit updates `due_at`; concurrent updates respect the unique constraint.
- E2E (`apps/web/test/e2e/srs-no-repeat.spec.ts`): seed a user who completed a lesson yesterday; load `/app`; assert "this week's focus" is a different module. Mark the just-shown lesson as `revisit: true`; advance the clock 8 days (test-only DB helper); load `/app`; assert that lesson is back as the focus, with the "due for a quick review" hint.
- Backfill test (`scripts/test/backfill-lesson-review-schedule.test.ts`): given a fixture of `lesson_progress` rows, the backfill produces the expected schedule rows; re-running is a no-op.

---

## Acceptance criteria

- Migration `0013` applied; backfill run in dev + staging; no orphaned rows.
- Picker pre-filter is applied before scoring; existing scoring logic unchanged (TASK-024 / ADR 0014 stays the source of truth for *which* due lesson wins).
- "Due for a quick review" hint renders on the lesson card when the pick is a re-surface; the revisit-ack copy renders on toggle.
- Re-surface fatigue eval: across the Sprint 4 cohort's recorded session history, replay the picker with SRS on; assert ≥ 95% reduction in same-lesson re-picks within 3 days vs. baseline. (Replay harness lives in `packages/picker/test/replay/`.)
- ADR 0026 written.
- `pnpm lint typecheck test` green; answers + safety eval don't regress.
- `docs/schema-v2.md` (or v1 if not yet split) carries the new table — owned by TASK-043 but stubbed here.

---

## Out of scope

- Notifications / reminders when a lesson goes due. SRS surfaces re-reviews **inside** `/app` only; push/SMS/email is Sprint 6+ (and called out in Sprint 5 deferrals).
- Per-card or per-section spacing. The unit is the lesson (module). A user who completed cards 1–3 but bailed on 4 is still "started_not_completed" at the module level.
- User-visible bucket numbers or "leech" metaphors. The hint is in plain English; the bucket is implementation detail.
- A "schedule everything I've ever seen" import from elsewhere. New users start with no schedule rows; first interaction creates them.
- Changing the picker's stage/topic scoring weights. SRS is orthogonal.
- Cross-module dependencies ("don't show lesson B until lesson A is reviewed"). Each module's schedule is independent.

---

## Decisions to make in the PR

- **The interval table.** `[1, 3, 7, 14, 30, 60]` days is the strawman. If it survives PM read, freeze it in `srs.ts` and reference from ADR.
- **Whether to expose a "skip this lesson for a while" affordance.** Strawman: no. Re-surface fatigue is solved by the schedule itself; an extra button risks users bucket-zeroing everything.
- **Where the hint copy lives.** Inline in the lesson surface component (TASK-024) or in the content authoring tool (TASK-028) so Care Specialist can edit. Strawman: inline; the phrasing is structural, not editorial.

---

## Questions for PM before starting

1. **Algorithm sign-off.** SM-2-lite per §2 — confirm or push back. The simpler "days since last review with a 7-day default" alternative is also defensible if you want SRS-as-cooldown rather than SRS-as-curriculum.
2. **The revisit-ack copy.** "Got it — we'll bring this back around in about a week." Is "we" the right voice? TASK-033 leans on first-person plural; TASK-024's lesson surface uses second-person ("here's your lesson"). Confirm.
3. **Replay harness as a release gate.** The 95% reduction in same-lesson re-picks claim above — do we want it baked into CI as a hard gate, or as a one-time number reported in the ADR?

---

## How PM verifies

1. Apply migration `0016`. Run the backfill against dev. Spot-check 5 user/module pairs against `lesson_progress`.
2. As a beta-cohort user (any account that has completed ≥ 1 lesson), open `/app`. The "this week's focus" card should be a module not in the user's last-3-days completions.
3. Mark a completed module as `revisit: true` from the lesson surface. Confirm the ack copy renders. Inspect `lesson_review_schedule` — `due_at` should be ≥ 3 days out.
4. Use the test-only "advance clock" helper to push the user past their next `due_at`. Reload `/app`. Confirm the picker selects that module and renders the "due for a quick review" hint.
5. Read ADR 0026.
