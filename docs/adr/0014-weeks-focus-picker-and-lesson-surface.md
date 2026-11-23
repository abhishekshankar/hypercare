# ADR 0014: This week’s focus picker, daily lesson surface, and weekly check-in

## Status

Accepted (Sprint 2)

## Context

The home screen (PRD §6.3) must close the retention loop: a **personalized** module focus, a **5-minute lesson** (PRD §6.5) that writes to `lesson_progress`, and a **weekly check-in** that records the north-star behavior (PRD §3.3) into `weekly_checkins`. Picker input comes from the care-profile change log, `getRecentTopicSignal` (no LLM), and stage baseline, with a **14-day anti-repeat** window on completed lessons. Check-in surfacing uses standard **7-day** cadence with **3-day elevation** when there are at least two soft `self_care_burnout` flags in 7 days (PRD §10.4, burnout self-check).

## Decision

1. **Package boundary** — `pickThisWeeksFocus` lives in `@alongside/picker`, depending only on `@alongside/db` and `@alongside/rag` for `getRecentTopicSignal`. No RAG/LLM calls inside the picker.
2. **Policy order** — (1) profile change in 7d (hardest-thing text → topic via keyword map, or `inferred_stage` change) → (2) recent topic signal (14d window for messages; topics ranked by `getRecentTopicSignal`) → (3) stage baseline, round-robin by `modules.created_at`, with re-pick of a recently completed module only when no other candidate exists.
3. **Anti-repeat** — Any lesson with `completed_at` in the last 14 days is excluded in steps 1–2. Step 3 may fall back to such a module only when the filtered set is empty.
4. **Lesson body** — Core cards use the first three `##` sections. If there are no `##` sections, the body is split into thirds. Fewer than three sections after `##` are padded with the module `summary` as “Key takeaway” cards.
5. **Lesson source** — `lesson_progress.source` is taken from a `?source=` query for deep links, defaulting to `library_browse` per product preference.
6. **Check-in** — Binary “tried something” plus optional one-line `what_helped` text; `Skip` still inserts a row with `answered_at` and `tried_something = null` so the card does not reappear until cadence.

## Consequences

- The picker stays testable with pure `pickThisWeeksFocusFromData` without a database.
- New topic keywords for “hardest thing” are a single list in `packages/picker` (`hardest-map.ts`) until a taxonomy service exists.
- Product copy for subtitles and check-in is centralized in `apps/web` (`focus-subtitle`, `CheckinCard`).

## Alternatives considered

- **Recent-topic before profile change** — Rejected: explicit profile edits (especially hardest-thing) should win over passive chat signal when the user is telling us their situation changed.
- **7-day anti-repeat** — Rejected: aligned 14d with the recent-topic signal window in ADR-0013.
- **Picker inside `@alongside/rag`** — Rejected: keeps RAG as retrieval/answer only and avoids pulling Bedrock into a metadata-only feature (even as a dependency, package naming matters for reviewers).
