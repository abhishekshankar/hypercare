# TASK-019 — Schema v1: lesson progress, weekly check-ins, topic taxonomy, profile change-log

- **Owner:** Cursor
- **Depends on:** TASK-004 (drizzle schema v0)
- **Unblocks:** TASK-020 (profile editor needs change-log), TASK-022 (topic classifier needs `module_topics` + taxonomy), TASK-023 (library needs topic + stage indexes), TASK-024 (lesson surface needs `lesson_progress` + `weekly_checkins`)
- **Status:** in_review
- **ADR:** `docs/adr/0012-schema-v1-retention-loop.md` (new, write as part of this task)

---

## Why this exists

Sprint 2 is the retention loop. Three of the six tickets (020, 022, 024) are blocked on data the schema doesn't capture yet:

1. **`lesson_progress`** — Sprint 1 has no concept of "I read this lesson." Without it the picker can't avoid repeats and the north-star metric (PRD §3.3) has nothing to attach to.
2. **`weekly_checkins`** — The PRD's behavior-change metric is literally one row per week per user with a yes/no plus a free-text "what did you try." Today there is no table for it.
3. **`module_topics`** — The PRD's §7.1 taxonomy (behaviors / daily_care / communication / medical / legal_financial / transitions / caring_for_yourself) lives only as a `modules.category` CHECK constraint today. The lesson picker needs **finer-grained topic tags per module** ("sundowning," "bathing-resistance," "guilt") so it can match against what the user has been asking about. We add a relational `module_topics` join table so a module can carry many topics, and a seeded `topics` reference table so the topic classifier in TASK-022 has a closed vocabulary to classify into.
4. **Care profile change-log** — The PRD §5.6 "evolution over time" surface needs an audit trail of profile edits so the picker (and later, the answering pipeline) can reason about "this changed last week." Today `care_profile` has only the current state.

Doing all four in one schema migration keeps `packages/db` migration count low and avoids a second round of migrations partway through the sprint.

This task is **schema only**: tables, indexes, drizzle types, one migration SQL file, one seed script for the topic taxonomy, and the ADR. It does **not** touch any UI, any RAG layer, any safety layer.

---

## Context to read first

1. `PROJECT_BRIEF.md` §5 (DB conventions — Drizzle, never edit a shipped migration), §8 (no secrets).
2. `prd.md` §3.3 (north-star metric), §5.6 (profile evolution), §6.5 (lesson structure), §7.1 (the seven categories — these are the **categories**, not the **topics**).
3. `packages/db/src/schema/` — the existing seven schema files, especially `care-profile.ts`, `modules.ts`, `messages.ts`.
4. `packages/db/migrations/` — see how the `messages.citations` migration (TASK-011) shaped the file numbering and naming convention. The next file number is the convention.
5. `docs/adr/0002-drizzle-schema-v0.md` — schema v0 rationale; v1 is an additive extension, not a rewrite.
6. `docs/schema-v0.md` — running schema doc; you'll extend (or fork into `schema-v1.md`).

---

## What "done" looks like

### New tables

#### `topics` (reference table — seeded, not user-editable)

```
slug              text primary key            -- e.g. "sundowning"
category          text not null               -- one of the 7 §7.1 categories (FK-shaped CHECK, mirror modules.category)
display_name      text not null               -- "Sundowning"
created_at        timestamptz not null default now()
```

Seed with **at least these 18 topics** (can grow; this is the v0 closed set the topic classifier classifies into). Group by category:

- behaviors: `sundowning`, `repetitive-questions`, `accusations-paranoia`, `agitation-aggression`, `wandering`, `refusal-of-care`
- daily_care: `bathing-resistance`, `eating-swallowing`, `sleep-problems`, `medication-management`
- communication: `how-to-talk`, `non-recognition`, `validation-basics`
- medical: `understanding-diagnosis`, `hospital-visits`
- legal_financial: `power-of-attorney`, `paying-for-care`
- caring_for_yourself: `caregiver-burnout`, `guilt-and-grief`, `asking-for-help`

(transitions intentionally has none in v0 — content team hasn't asked for them yet; ADR notes this.)

#### `module_topics` (join table — module ↔ topic, many-to-many)

```
module_id    uuid not null references modules(id) on delete cascade
topic_slug   text not null references topics(slug) on delete restrict
primary key (module_id, topic_slug)
```

Index on `topic_slug` for picker-side reads. Backfill: leave empty in the migration; a follow-up data step (in TASK-023 or TASK-024) tags the 3 seeded modules. Out of scope here.

#### `lesson_progress`

```
id              uuid primary key default gen_random_uuid()
user_id         uuid not null references users(id) on delete cascade
module_id       uuid not null references modules(id) on delete cascade
started_at      timestamptz not null default now()
completed_at    timestamptz null            -- null while in progress; set when user closes with "Got it"
revisit         boolean not null default false   -- true when user picks "I want to revisit this"
source          text not null               -- "weekly_focus" | "library_browse" | "search" | "conversation_link"
unique (user_id, module_id, started_at)     -- a user can take the same lesson again later
```

Indexes:
- `(user_id, completed_at desc)` — picker reads recent completions to avoid repeats
- `(user_id, module_id)` — for "have I taken this?" lookups

`source` is a free-form text with a CHECK constraint enumerating the four values. Adding new sources later is a new migration; that's fine.

#### `weekly_checkins`

```
id                     uuid primary key default gen_random_uuid()
user_id                uuid not null references users(id) on delete cascade
prompted_at            timestamptz not null default now()
answered_at            timestamptz null
tried_something        boolean null         -- the north-star yes/no (PRD §3.3)
what_helped            text null            -- free text, optional
unique (user_id, prompted_at)               -- at most one prompt per (user, instant)
```

Indexes:
- `(user_id, answered_at desc nulls last)` — surface the most recent unanswered prompt
- `(user_id, prompted_at desc)` — show history on the profile screen later (out of scope this sprint; just don't preclude it)

#### `care_profile_changes` (change-log)

```
id              uuid primary key default gen_random_uuid()
user_id         uuid not null references users(id) on delete cascade
section         text not null               -- "about_cr" | "stage" | "living" | "about_you" | "what_matters"
field           text not null               -- e.g. "hardest_thing_now"
old_value       jsonb null                  -- nullable — first set has no prior
new_value       jsonb not null
changed_at      timestamptz not null default now()
trigger         text not null               -- "user_edit" | "evolved_state_flow" | "system_inferred"
```

Indexes:
- `(user_id, changed_at desc)` — recent-change reads from the picker
- `(user_id, section, changed_at desc)` — section-scoped reads from the profile screen

The actual `care_profile` row is still mutated in place (no shadow-table rewrite — that's a v3 problem); the change-log is **append-only and additive**. Writing to it on every profile edit is TASK-020's job; this ticket only creates the table.

### Drizzle schema files

One file per new table under `packages/db/src/schema/`:
- `topics.ts`
- `module-topics.ts`
- `lesson-progress.ts`
- `weekly-checkins.ts`
- `care-profile-changes.ts`

Add the relations and re-export from `packages/db/src/schema/index.ts`. Match the existing files' style (see `messages.ts` and `module-chunks.ts` as the templates).

### Migration

One SQL file at `packages/db/migrations/NNNN_schema_v1_retention_loop.sql` (use the next sequential number). Keep it readable: tables first, then indexes, then the `topics` seed inserts. Wrap in a single transaction. **Do not** edit any prior migration.

### Seed script

A small script `packages/db/scripts/seed-topics.ts` that inserts the v0 topic list **idempotently** (`on conflict (slug) do nothing`). Wired up as `pnpm --filter @alongside/db seed:topics` in `packages/db/package.json`. The migration also seeds the same rows (so a fresh DB is good after `drizzle-kit migrate`); the script exists so we can re-run after expanding the list without writing a new migration during sprint 2.

### Documentation

- `docs/adr/0012-schema-v1-retention-loop.md`: one-page ADR. Cover (a) why a separate `topics` table instead of a string column on `modules`, (b) why an append-only change-log instead of audit triggers, (c) the `unique (user_id, module_id, started_at)` choice on `lesson_progress` (allows retakes; lookups use the `(user_id, module_id)` index).
- Extend `docs/schema-v0.md` (or create `docs/schema-v1.md` if you'd rather fork — call your shot in the report-back).

---

## Acceptance criteria

- `pnpm --filter @alongside/db typecheck lint test` green.
- New migration SQL applies cleanly to a fresh `hypercare_dev` (`drizzle-kit migrate` from a wiped DB succeeds; verified locally via the SSM tunnel per `docs/infra-runbook.md`).
- New migration SQL applies cleanly to a `hypercare_dev` that already has sprint-1 data (no destructive ops; backfill via add-with-default where any non-null column is added — this ticket adds **no** non-null columns to existing tables, so this should be free).
- `pnpm --filter @alongside/db seed:topics` is idempotent (running twice does not error and does not duplicate rows).
- All five new tables visible via `\d+` in psql with the documented columns, types, FKs, and indexes.
- `topics` table contains the 20 seeded rows (the 18 above plus 2 of your choice if the count needs to be even — call your shot).
- ADR 0012 written and committed.
- `docs/schema-v0.md` (or new `schema-v1.md`) updated.

---

## Files to create / modify

### Create

```
packages/db/src/schema/topics.ts
packages/db/src/schema/module-topics.ts
packages/db/src/schema/lesson-progress.ts
packages/db/src/schema/weekly-checkins.ts
packages/db/src/schema/care-profile-changes.ts
packages/db/migrations/NNNN_schema_v1_retention_loop.sql
packages/db/scripts/seed-topics.ts
docs/adr/0012-schema-v1-retention-loop.md
docs/schema-v1.md            # or extend docs/schema-v0.md — your call
```

### Modify

```
packages/db/src/schema/index.ts                # re-export new tables
packages/db/package.json                       # add seed:topics script
TASKS.md                                       # status pending → in_progress → in_review
```

### Do **not** touch

- Any sprint-1 schema file's column shapes.
- Any sprint-1 migration SQL.
- `packages/rag/**`, `packages/safety/**`, `apps/web/**`. Schema only.

---

## Out of scope

- **Reading or writing the new tables from any application code.** TASKs 020, 022, 023, 024 do that.
- A pgvector index on any of the new tables (none of these are vector tables).
- Backfilling `module_topics` for the 3 seeded modules — done in TASK-023's content-tagging step.
- Audit triggers, materialized views, partitioning. v0.
- Any UI, any route handler, any zod schema for the API surface.

---

## Decisions to make in the PR

- **Naming `weekly_checkins` vs `weekly_check_ins`.** Pick one; mirror the existing snake_case style in other table names (`care_profile`, `module_chunks` — no mid-word underscores in the singular noun, so `weekly_checkins` matches better). Note your choice in the ADR.
- **`source` on `lesson_progress` as text + CHECK vs an enum type.** Drizzle handles both; the existing schema uses CHECK constraints (e.g. `modules.category`). Match that — keep it text + CHECK.
- **Index naming convention.** Match what `module-chunks.ts` and `messages.ts` already use.

---

## Questions for PM before starting

1. The 18 seeded topics above — sign off, or want different ones? (My vote: ship as-is; the topic classifier in TASK-022 will surface gaps fast and we add via the seed script, no migration needed.)
2. `care_profile_changes` — keep `old_value`/`new_value` as `jsonb` (flexible, future-proof) or split into per-field columns (typed, but locks the shape)? My vote: jsonb, with the ADR noting that the shape is "whatever the section's edit form sends," validated at the route handler in TASK-020.
3. `docs/schema-v0.md` extend, or fork into `docs/schema-v1.md`? My vote: fork — `schema-v0.md` becomes a frozen snapshot, `schema-v1.md` is the new living doc.

---

## How PM verifies

1. `git checkout task/TASK-019-schema-v1-retention-loop`
2. `pnpm install && pnpm --filter @alongside/db typecheck lint test`
3. SSM tunnel up; `DATABASE_URL_ADMIN` set; `pnpm --filter @alongside/db migrate` against a fresh `hypercare_dev`.
4. `psql $DATABASE_URL_ADMIN -c '\dt'` — see the five new tables.
5. `psql $DATABASE_URL_ADMIN -c 'select count(*) from topics;'` — returns the seeded count.
6. `pnpm --filter @alongside/db seed:topics` — runs cleanly twice in a row, count unchanged on the second run.
7. Read ADR 0012 — convince me on the three decisions above.

---

## Report-back

- File list (drizzle schema files + migration + seed + ADR + schema doc).
- Migration SQL inline in the PR description (it's <200 lines; I want to read it without checkout).
- `psql \d+ <table>` output for each of the 5 new tables, pasted in the PR.
- The three decisions above with the rationale you landed on.
- Any topic from the seed list you'd add or drop based on what you saw while writing the migration.
