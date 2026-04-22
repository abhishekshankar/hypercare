# Schema v1 — retention loop (TASK-019)

Sprint 2 **additive** layer on [schema v0](schema-v0.md). v0 is kept as a historical snapshot; this page is the current contract for `packages/db` after migration `0003_schema_v1_retention_loop.sql` and follow-ups (e.g. `0005_messages_classified_topics.sql`, `0006_modules_try_this_today.sql` — short optional line for lesson/module “try this today”).

## ERD (ASCII)

```
┌─────────────┐       ┌──────────────┐       ┌────────────────┐
│   users     │──1:1──│ care_profile │       │   modules      │
└──────┬──────┘       └──────┬───────┘       └───────┬────────┘
       │                      │                    │
       │ 1:N (append)         │                    │ M:N
       ▼                      │                    ▼
┌──────────────────┐         │            ┌────────────────┐
│ care_profile_    │         │            │  module_topics │◄──┐
│ changes          │         │            └────────┬───────┘   │
└──────────────────┘         │                      │         │
       │                      │                    │         │
       │ 1:N                  │                    │     ┌───┴────────┐
       │ (lesson)             │                    │     │  topics   │
       ▼                      │                    │     │  (vocab)  │
┌──────────────┐               │                    │     └───────────┘
│lesson_      │               │                    │
│progress     │               │                    │
└──────────────┘               │                    │
       ▲                      │                    │
       │ 1:N                  │                    │
┌──────┴───────┐       ┌──────┴──────┐            │
│ weekly_      │       │   ... v0  │            │
│ checkins     │       │  tables   │            │
└──────────────┘       └───────────┘            │
       ▲                                        │
       └──── users (1:N) ───────────────────────┘
```

## New tables (writes by ticket)

| Table | Purpose | Writes | Reads (planned) |
| --- | --- | --- | --- |
| `topics` | Closed topic vocabulary (slug, category, display name) | TASK-019 migration + `seed:topics` | TASK-022 classifier, TASK-023/024 picker |
| `module_topics` | Many-to-many: module ↔ topic | TASK-023 tagging | Library + picker |
| `lesson_progress` | One row per lesson attempt; `completed_at` / `revisit` / `source` | TASK-024 | Picker, metrics |
| `weekly_checkins` | North-star check-in: `tried_something`, `what_helped` | TASK-024 | Home, analytics |
| `care_profile_changes` | Append-only profile edit log (JSON `old`/`new`) | TASK-020 | Picker, profile history |

## Extensions

Unchanged from v0 (`pgcrypto`, `vector`).

## Topic seed

Twenty rows are seeded in `0003` (v0 set; `transitions` has no topic rows yet). Expand via `pnpm --filter @hypercare/db seed:topics` from `src/seed/topic-seed-data.ts` until a taxonomy break warrants a new migration + ADR.

## `messages` columns (TASK-022)

Migration `0005_messages_classified_topics.sql` adds:

| Column | Type | Meaning |
| --- | --- | --- |
| `classified_topics` | `jsonb` not null default `[]` | 0–3 `topics.slug` strings for **user** rows; `[]` for assistant/system. |
| `topic_confidence` | `real` nullable | Classifier score in \([0,1]\) when `classified_topics` is non-empty; else null. |

Written by the chat route from `rag.answer()` / `AnswerResult` (see ADR-0013).

## App connection

Unchanged: runtime uses **`hypercare_app`**; migrations/admin use the documented admin URL (`docs/infra-runbook.md`).
