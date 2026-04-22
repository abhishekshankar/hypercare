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
| `module_briefs` | Content brief queue (topic, audience, outcome, `queue_reason`) | Internal content API | Authoring, briefs list |
| `module_evidence` | Citations + tier for each module | Internal content API | Review + expert gate |
| `module_reviews` | Verdict + `review_role` (expert, lived, SME, etc.) | Internal content API | Publish gate by category |
| `module_versions` | Snapshot at each publish (body + `version`) | `publish` ingest path | Runbook / metrics |
| `module_state_transitions` | Auditable `from_status` / `to_status` | Transition API | Internal audit |

**`users.role`** and **`modules` authoring columns** (migration `0008_content_authoring_workflow.sql`): `role` in (`caregiver`, `content_writer`, `content_lead`, `medical_director`, `care_specialist`, `caregiver_support_clinician`, `lived_experience_reviewer`, `admin`); `modules.draft_status`, `assigned_*_reviewer_id`, `brief_id`, `last_published_at`. See ADR-0018.

## Extensions

Unchanged from v0 (`pgcrypto`, `vector`).

## Topic seed

Twenty rows are seeded in `0003` (v0 set; `transitions` has no topic rows yet). Expand via `pnpm --filter @hypercare/db seed:topics` from `src/seed/topic-seed-data.ts` until a taxonomy break warrants a new migration + ADR.

## `conversation_memory` (TASK-027)

Migration `0011_conversation_memory.sql`.

| Column | Type | Meaning |
| --- | --- | --- |
| `conversation_id` | uuid PK, FK → `conversations` | One row per thread; cascades on conversation delete. |
| `user_id` | uuid FK → `users` | Denormalized for invalidation by user. |
| `summary_md` | text | Structured markdown (four headings; ≤ ~400 token budget). |
| `summary_tokens` | int | Approximate count at write time. |
| `last_refreshed_at` | timestamptz | Last successful or fallback refresh. |
| `refresh_count` | int | Monotonic success counter. |
| `invalidated` | boolean | Set when `care_profile_changes` is written; next user turn forces refresh. |
| `source_message_ids` | uuid[] | Message ids in the summarized window. |

## `user_sessions` and `admin_audit` (TASK-029)

Migration `0010_metrics_surface.sql`:

- **`user_sessions`** — debounced `/app` visits for cohort “active” definition (no PII beyond `user_id` + path).
- **`admin_audit`** — who opened `/internal/*` and when.
- Additional **`messages`** columns: `rated_at`, `rating`, `rating_invited`, `retrieval_top_tier`, `refusal_reason_code`, `bedrock_input_tokens`, `bedrock_output_tokens`, `generation_latency_ms`.

## `messages` columns (TASK-022)

Migration `0005_messages_classified_topics.sql` adds:

| Column | Type | Meaning |
| --- | --- | --- |
| `classified_topics` | `jsonb` not null default `[]` | 0–3 `topics.slug` strings for **user** rows; `[]` for assistant/system. |
| `topic_confidence` | `real` nullable | Classifier score in \([0,1]\) when `classified_topics` is non-empty; else null. |

Written by the chat route from `rag.answer()` / `AnswerResult` (see ADR-0013).

## `saved_answers` (TASK-030)

Migration `0009_saved_answers.sql` adds:

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | uuid PK | Save row id. |
| `user_id` | uuid → `users(id)` ON DELETE CASCADE | Owner. |
| `message_id` | uuid → `messages(id)` ON DELETE CASCADE | Assistant message bookmarked. |
| `note` | text | Optional 240-char note; enforced in API. |
| `saved_at` | timestamptz | When saved. |

Unique `(user_id, message_id)`. Index `(user_id, saved_at DESC)` for home + list reads.

## App connection

Unchanged: runtime uses **`hypercare_app`**; migrations/admin use the documented admin URL (`docs/infra-runbook.md`).
