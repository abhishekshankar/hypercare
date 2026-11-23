# ADR 0012 — Schema v1: retention loop (TASK-019)

## Status

Accepted (Sprint 2).

## Context

Sprint 2’s retention loop (lesson focus, library, check-ins) needs durable facts the v0 model did not store: per-user lesson state, one row per week for the behavior-change check-in, many-to-many module tags in a **closed** topic vocabulary, and an append-only log of care-profile edits for the picker and for “what changed when.” v1 is an **additive** migration on top of ADR 0002 (Drizzle schema v0); it does not rewrite existing tables or shipped migrations.

## Decisions

### 1. `topics` as a table + `module_topics` join — not a string column on `modules`

We need **many** topic tags per module (e.g. “sundowning” and “evening-escalation” on the same unit), and a **closed vocabulary** for the topic classifier in TASK-022. A `text[]` on `modules` is awkward to constrain, index for picker queries, and evolve without table scans. A reference table `topics` (PK `slug`) plus `module_topics (module_id, topic_slug)` gives enforceable foreign keys, a single place to add display names and category alignment, and a seed path (`INSERT … ON CONFLICT DO NOTHING` + `pnpm seed:topics`) that can grow the list without a migration for every new tag until taxonomy is formally revised.

`topics.category` mirrors `modules.category` (CHECK on the same seven PRD §7.1 values). The **v0** seed has **20** topic rows, all in categories other than `transitions` (no transition-specific topics requested yet; the category remains valid for `modules` and for future `topics` rows).

### 2. Append-only `care_profile_changes` — not full-row audit triggers

The live profile stays a single `care_profile` row (unchanged from v0). History is captured as **append-only** JSON patches (`old_value` / `new_value`) with `section`, `field`, and `trigger`. This avoids `BEFORE UPDATE` shadow tables, keeps writes explicit in app code (TASK-020), and matches “what the edit form sent,” validated at the API boundary. `jsonb` is flexible as new fields are added; per-field physical columns would lock the schema to today’s form shape.

### 3. `lesson_progress` uniqueness on `(user_id, module_id, started_at)` — not “one row per user per module”

The product allows **retaking** the same module later. Uniqueness on `(user_id, module_id, started_at)` encodes a new attempt whenever `started_at` changes; “most recent / completed for this module” queries use the `(user_id, module_id)` index and sort by `completed_at` in application SQL. A single completed row per module would have forced destructive updates or synthetic versioning in v1.

`source` is `text` with a CHECK (same style as v0: `modules.category`, `messages.role`) — not a Postgres `ENUM` — so we avoid painful label migrations when a new source is added later.

### 4. Table name `weekly_checkins` (one word, plural)

Matches common snake_case in this project (`module_chunks`, `care_profile` without a mid-word break after `weekly_`). The alternative `weekly_check_ins` reads as three tokens; we standardize on `weekly_checkins`.

## Consequences

- New tables: `topics`, `module_topics`, `lesson_progress`, `weekly_checkins`, `care_profile_changes`.
- Migration: `packages/db/migrations/0003_schema_v1_retention_loop.sql` (includes topic seed; `scripts/seed-topics.ts` re-runs the same list idempotently).
- **No** app reads or writes in TASK-019 — TASK-020, TASK-022, TASK-023, TASK-024 consume these tables.
- `docs/schema-v0.md` remains the Sprint 1 snapshot; the living ERD and table list for v1+ is `docs/schema-v1.md`.
