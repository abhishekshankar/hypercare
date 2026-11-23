# ADR 0026: Spaced-repetition (SM-2-lite) for “This week’s focus”

## Status

Accepted (Sprint 5 / TASK-037)

## Context

Closed beta (TASK-036) surfaced **re-surface fatigue**: the TASK-024 picker could show the same module within a few days because the 14-day anti-repeat loses to stage/topic signals. Caregivers also asked to **re-read** helpful lessons on a predictable cadence; `lesson_progress.revisit` existed but did not drive timing.

PRD §1.3 had deferred full SRS; the cohort proved the lesson loop enough to add **scheduling without replacing** the picker policy (ADR 0014).

## Decision

1. **Data model** — `lesson_review_schedule` (unique `(user_id, module_id)`): `bucket` 0–5, `due_at`, `last_seen_at`, `last_outcome` ∈ {`started_not_completed`, `completed`, `revisit_requested`}), audit columns `created_at` / `updated_at`. `module_id` is UUID FK to `modules` (same as `lesson_progress`), not free text.

2. **Intervals** — Fixed days per bucket, exported as `SRS_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60]` in `packages/picker/src/srs.ts`. Changing the table requires an ADR amendment.

3. **Transitions** (TASK-037 ticket §2):

   - **Lesson start** — upsert: `bucket = 0`, `due_at = now + interval[0]`, `last_outcome = started_not_completed`, `last_seen_at = now`. On conflict (restart), update `last_seen_at` / `updated_at` only.
   - **Lesson complete, “Got it”** — `bucket = min(prev + 1, 5)`, `due_at = now + interval[bucket]`, `last_outcome = completed`.
   - **Lesson complete, “Revisit”** — `bucket = max(prev − 2, 1)`, `due_at = now + interval[bucket]`, `last_outcome = revisit_requested` (never sooner than bucket 1 → 3-day spacing).

4. **Picker** — SRS is a **pre-filter** on the published module list before ADR 0014 ordering (profile → topic → stage). A module is in the strict candidate set if it has **no** schedule row (**never_seen**) or `due_at ≤ now` (**due**). If that set is empty (all **not_yet_due**), fall back to the module(s) with the **earliest** `due_at`, then run the usual picker; if that still yields `no_pick`, rerun once on the **full** list without SRS (same as turning scheduling off for one pick).

5. **Anti-repeat** — The 14-day `recentlyCompleted` set excludes a module when its schedule says **due** (`due_at ≤ now`), so a due review can surface even inside the 14-day window.

6. **Transparency** — Home card and lesson surface may show *“Last seen N days ago — due for a quick review.”* when `last_outcome ≠ started_not_completed`. After **Revisit**, the API returns an ack whose horizon is derived from `due_at` via `dueAtToApproximateLabel`.

7. **Resilience** — Schedule upsert failures are logged; they do not fail lesson start/complete. The next pick degrades toward TASK-024-only behavior.

## Consequences

- **Backfill** — `scripts/backfill-lesson-review-schedule.ts` can synthesize rows from historical `lesson_progress` for dev/staging; production may run after migration `0016_lesson_review_schedule.sql`.
- **Retention** — `lesson_review_schedule` follows the same 730-day rolling window as `lesson_progress` (`updated_at`), per TASK-032 posture.
- **Not in scope** — Push/SMS reminders; per-section scheduling; changing ADR 0014 scoring weights.

## Relation to ADR 0014

ADR 0014 remains the source of truth for **which signal wins** among eligible modules. ADR 0026 only **narrows eligibility** by due state; it does not re-score or reorder beyond that filter.

---

Schema documented in [`docs/schema-v2.md`](../schema-v2.md) § `lesson_review_schedule`. (TASK-043.)
