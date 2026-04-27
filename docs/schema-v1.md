# Schema v1 — retention loop (TASK-019)

> **Sprint 5 update:** Schema v2 in [`docs/schema-v2.md`](schema-v2.md) extends this. v1 remains accurate; v2 adds without modifying. New tables and columns shipped in Sprint 5 (TASK-037, TASK-038, TASK-039, TASK-042) live in v2. (TASK-043.)

Sprint 2 **additive** layer on [schema v0](schema-v0.md). v0 is kept as a historical snapshot; this page is the current contract for `packages/db` after migration `0003_schema_v1_retention_loop.sql` and follow-ups (e.g. `0005_messages_classified_topics.sql`, `0006_modules_try_this_today.sql` — short optional line for lesson/module “try this today”). **Family sharing (TASK-038):** migration `0017_family_sharing.sql` adds `care_profile_members`, `invite_tokens`, and `care_profile_changes.changed_by` — see [ADR 0027](adr/0027-family-sharing-data-model-and-privacy.md).

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

**Household reads (TASK-038):** the diagram still shows `users` → `care_profile` as 1:1 via `care_profile.user_id` (primary owner / back-compat). **Accepted co-caregivers** do not get their own `care_profile` row; they join the owner’s row through `care_profile_members` (`getCareProfileForUser` in `packages/db`).

## New tables (writes by ticket)

| Table | Purpose | Writes | Reads (planned) |
| --- | --- | --- | --- |
| `topics` | Closed topic vocabulary (slug, category, display name) | TASK-019 migration + `seed:topics` | TASK-022 classifier, TASK-023/024 picker |
| `module_topics` | Many-to-many: module ↔ topic | TASK-023 tagging | Library + picker |
| `lesson_progress` | One row per lesson attempt; `completed_at` / `revisit` / `source` | TASK-024 | Picker, metrics |
| `lesson_review_schedule` | One row per (user, module): bucket 0–5, `due_at`, `last_seen_at`, `last_outcome` | TASK-037 (start + complete) | Picker SRS pre-filter, privacy export |
| `weekly_checkins` | North-star check-in: `tried_something`, `what_helped` | TASK-024 | Home, analytics |
| `care_profile_changes` | Append-only profile edit log (JSON `old`/`new`); **`changed_by`** (TASK-038) = editor | TASK-020, TASK-038 | Picker, profile history, transparency |
| `care_profile_members` | Household: owner + co-caregivers; pending rows use `invitee_email` | TASK-038 | `getCareProfileForUser`, profile APIs |
| `invite_tokens` | SHA-256 hashed opaque token → pending member row; single-use | TASK-038 | Invite accept flow (when shipped) |
| `module_briefs` | Content brief queue (topic, audience, outcome, `queue_reason`) | Internal content API | Authoring, briefs list |
| `module_evidence` | Citations + tier for each module | Internal content API | Review + expert gate |
| `module_reviews` | Verdict + `review_role` (expert, lived, SME, etc.) | Internal content API | Publish gate by category |
| `module_versions` | Snapshot at each publish (body + `version`) | `publish` ingest path | Runbook / metrics |
| `module_state_transitions` | Auditable `from_status` / `to_status` | Transition API | Internal audit |

**`users.role`** and **`modules` authoring columns** (migration `0008_content_authoring_workflow.sql`): `role` in (`caregiver`, `content_writer`, `content_lead`, `medical_director`, `care_specialist`, `caregiver_support_clinician`, `lived_experience_reviewer`, `admin`); `modules.draft_status`, `assigned_*_reviewer_id`, `brief_id`, `last_published_at`. See ADR-0018.

## Extensions

Unchanged from v0 (`pgcrypto`, `vector`).

## Topic seed

Twenty rows are seeded in `0003` (v0 set; `transitions` has no topic rows yet). Expand via `pnpm --filter @alongside/db seed:topics` from `src/seed/topic-seed-data.ts` until a taxonomy break warrants a new migration + ADR.

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

## `conversation_memory_forgotten` and `user_actions` (TASK-033)

Migration `0015_transparency_memory_forgotten.sql`.

- **`conversation_memory_forgotten`** — per-bullet strings the caregiver asked to forget for a conversation (cap 30 rows per thread; cascades with `conversations`).
- **`user_actions`** — end-user product events (`transparency_forget`, `transparency_refresh`, `transparency_clear`, …) for metrics; distinct from `admin_audit`.

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

## `user_feedback` (TASK-036)

Migration `0012_user_feedback.sql`.

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | uuid PK | Feedback row. |
| `user_id` | uuid FK → `users` | Submitter. |
| `kind` | text | `off_reply` / `not_found` / `suggestion` / `other` / `thumbs_down`. |
| `body` | text | Free text; null for pure thumbs-down. |
| `conversation_id` | uuid nullable FK | Context thread. |
| `message_id` | uuid nullable FK | Assistant message (e.g. rated turn). |
| `include_context` | boolean | Whether transcript context was attached. |
| `submitted_at` | timestamptz | Insert time. |
| `triage_state` | text | Review state (`new`, `reading`, `needs_*`, `ack_and_close`, `spam_or_invalid`). |
| `triage_priority` | text | `normal` or `high` (escalation thumbs-down). |
| `triaged_by` | uuid nullable | Admin user. |
| `triaged_at` | timestamptz nullable | When triaged. |
| `resolution_note` | text | Reviewer note. |
| `linked_module_id` | uuid nullable FK → `modules` | Content follow-up. |
| `linked_task_id` | text | e.g. `TASK-036` reference. |

Partial unique index: at most one `thumbs_down` row per `message_id`.

## `care_profile` — stage questions v1 (TASK-034)

Migration `0013_stage_questions_v1.sql` adds:

| Column | Type | Notes |
| --- | --- | --- |
| `stage_questions_version` | int not null, default 0 | `0` = legacy `stage_answers` only; `1` = v1 ordinals populated. |
| `med_management_v1` | text (CHECK) | `self` / `reminders` / `hands_on_help` |
| `driving_v1` | text (CHECK) | `safe` / `worried` / `stopped_*` / `never_drove` |
| `alone_safety_v1` | text[] (CHECK subset) | Multi-select “worry” chips; see ADR 0023 |
| `recognition_v1` | text (CHECK) | |
| `bathing_dressing_v1` | text (CHECK) | |
| `wandering_v1` | text (CHECK) | |
| `conversation_v1` | text (CHECK) | |
| `sleep_v1` | text (CHECK) | |

Legacy `stage_answers` (jsonb) is **deprecated** for new data once users are on v1; it remains for the migration window. Sunset: follow ADR 0023 / sprint 5 plan.

## `care_profile_members` and `invite_tokens` (TASK-038)

Migration **`0017_family_sharing.sql`**. Privacy posture and product rules: [ADR 0027 — Family sharing](adr/0027-family-sharing-data-model-and-privacy.md).

### `care_profile_members`

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | uuid PK | Membership row. |
| `care_profile_id` | uuid FK → `care_profile` ON DELETE CASCADE | Shared profile. |
| `user_id` | uuid nullable FK → `users` | Set when **accepted**; null while invite is pending. |
| `invitee_email` | text nullable | Lowercased email for **pending** co-caregiver rows (`user_id` null). |
| `role` | text | `owner` \| `co_caregiver` (CHECK). |
| `invited_by` | uuid FK → `users` | Inviter (owner in v1). |
| `invited_at` | timestamptz | Row creation. |
| `accepted_at` | timestamptz nullable | Non-null when active member. |
| `removed_at` | timestamptz nullable | Soft-remove; excluded from active reads. |
| `share_conversations_with_other_members` | boolean default false | Future opt-in; v1 UI does not toggle. |
| `share_saved_answers_with_other_members` | boolean default false | Same. |

Partial unique indexes (in migration): one **owner** per `care_profile_id`; one **active** `(care_profile_id, user_id)` when `user_id` is set; one **pending** `(care_profile_id, invitee_email)` per email.

Backfill: one `owner` row per existing `care_profile` (`user_id` = `care_profile.user_id`, `accepted_at` = `care_profile.created_at`). New owners after migration: app calls `ensureOwnerMembershipRow` after onboarding creates the profile.

### `invite_tokens`

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | uuid PK | Token row. |
| `care_profile_member_id` | uuid FK → `care_profile_members` ON DELETE CASCADE | Pending membership this token unlocks. |
| `token_hash` | text | SHA-256 hex of opaque secret (raw token never stored). |
| `personal_message` | text nullable | Optional invite note for email body (when email ships). |
| `created_at` / `expires_at` / `consumed_at` | timestamptz | Mint, TTL (~7d strawman), single-use consumption. |

### `care_profile_changes.changed_by`

Not null after migration; backfilled from `user_id`. New inserts set both **`user_id`** and **`changed_by`** to the **editor** (same value today). Picker and “recent changes” aggregate edits across **all household actor ids** on that `care_profile_id`.

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

## Privacy & sessions (TASK-032)

Migration `0018_privacy_posture_v1.sql` (renamed from `0012_*` to resolve a journal index collision with `0012_user_feedback`). See `docs/adr/0021-privacy-retention-export-delete.md`.

| Object | Notes |
| --- | --- |
| `safety_flags.deidentified_at` | Set when a user is deleted and the row is preserved without identity linkage. |
| `admin_audit.meta`, `admin_audit.reason` | Optional JSON and free text; `user_id` nullable with `ON DELETE SET NULL` so events survive user removal. |
| `session_revocations` | PK `session_id`; optional `user_id`; `reason` ∈ `logout`, `user_delete`, `admin_revoke`, `ttl`. |
| `user_auth_sessions` | PK `session_id` (cookie `sid`); `last_seen_at`, `country_code` (edge header). |
| `privacy_export_requests` | Async export job + idempotency; `status` ∈ `pending`, `complete`, `error`. |

## App connection

Unchanged: runtime uses **`hypercare_app`**; migrations/admin use the documented admin URL (`docs/infra-runbook.md`).
