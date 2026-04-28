# Schema v2 — Sprint 5 additions (TASK-043)

Sprint 5 **additive** layer on [schema v1](schema-v1.md). v1 remains accurate; v2 adds without modifying — no rows or columns move between files. Forked at v1 = 215 lines (under the 600-line strawman in [`TASKS.md`](../TASKS.md) §"Sprint 4 quality gates"); the call to fork early gives Sprint 6 a clean baseline and keeps the Sprint 5 surface reviewable as a single coherent diff. v0 ([`schema-v0.md`](schema-v0.md)) remains the historical Sprint 1 snapshot.

The five additions in this file:

| Table / column | Migration | Ticket | ADR |
| --- | --- | --- | --- |
| `lesson_review_schedule` | `0016_lesson_review_schedule.sql` | TASK-037 | [0026](adr/0026-srs-scheduling-policy.md) |
| `care_profile_members` | `0017_family_sharing.sql` | TASK-038 | [0027](adr/0027-family-sharing-data-model-and-privacy.md) |
| `invite_tokens` | `0017_family_sharing.sql` | TASK-038 | [0027](adr/0027-family-sharing-data-model-and-privacy.md) |
| `safety_ft_shadow_decisions` + `user_feedback.safety_relabel` | `0019_safety_ft_shadow_decisions.sql` | TASK-039 | [0028](adr/0028-fine-tuned-safety-classifier.md) |
| `model_routing_decisions` + `users.routing_cohort` | `0021_model_routing.sql` | TASK-042 | [0030](adr/0030-per-user-model-routing.md) |

Two Sprint 5 streaming-telemetry tables (`lesson_stream_telemetry` and `library_search_streams`) and one latent-gap table (`user_suppression`) are documented in §"Sprint 5 ancillary tables and latent gaps" so the [`schema-doc-coverage`](../packages/db/test/schema-doc-coverage.test.ts) test passes against the full Drizzle surface (TASK-043 §"Tests" — backport per Q4).

`care_profile_members` and `invite_tokens` already have v1 entries from when TASK-038 landed mid-sprint (`schema-v1.md` §"`care_profile_members` and `invite_tokens` (TASK-038)"). v2 is the **canonical** schema-of-record going forward; the v1 section is preserved for the v1→v2 transition and is identical at the column level.

---

## `lesson_review_schedule` (TASK-037 / ADR 0026)

Migration **`0016_lesson_review_schedule.sql`**. Drizzle: [`packages/db/src/schema/lesson-review-schedule.ts`](../packages/db/src/schema/lesson-review-schedule.ts). Algorithm: SM-2-lite, intervals exported from `packages/picker/src/srs.ts`.

One row per `(user_id, module_id)` the user has interacted with. Inserted on first `lesson_started` event; updated on every subsequent completion or revisit toggle. Reads happen as a **pre-filter** on the picker's candidate set ([ADR 0014](adr/0014-weeks-focus-picker-and-lesson-surface.md) ordering is unchanged; ADR 0026 only narrows eligibility by due state).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` default. |
| `user_id` | uuid FK → `users(id)` ON DELETE CASCADE | Owner of the schedule row. |
| `module_id` | uuid FK → `modules(id)` ON DELETE CASCADE | Same FK shape as `lesson_progress`. |
| `bucket` | int CHECK `0..5` default `0` | SM-2-lite bucket; index into `SRS_INTERVAL_DAYS`. |
| `due_at` | timestamptz NOT NULL | Earliest moment the picker may re-surface this module. |
| `last_seen_at` | timestamptz NOT NULL | Last lesson start or completion timestamp. |
| `last_outcome` | text CHECK ∈ (`completed`, `started_not_completed`, `revisit_requested`) | Drives the "due for a quick review" hint copy. |
| `created_at` / `updated_at` | timestamptz default `now()` | Audit. |

**Indexes / constraints**

- `lesson_review_schedule_user_id_module_id_unique` — unique on `(user_id, module_id)`. Enforces one row per pair; underwrites idempotent backfill (`scripts/backfill-lesson-review-schedule.ts`) and concurrent-write safety.
- `lesson_review_schedule_user_id_due_at_idx` — btree on `(user_id, due_at)`. Hot path for the picker pre-filter scan ("which modules are due for me right now").

### Bucket interval table (inlined for reference)

Source of truth: `SRS_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60]` in [`packages/picker/src/srs.ts`](../packages/picker/src/srs.ts). Changing the table requires an [ADR 0026](adr/0026-srs-scheduling-policy.md) amendment.

| Bucket | Interval | When set |
| --- | --- | --- |
| 0 | 1 day | Lesson started, not yet completed. |
| 1 | 3 days | First completion (or revisit clamp floor). |
| 2 | 7 days | Second consecutive "Got it." |
| 3 | 14 days | Third consecutive completion. |
| 4 | 30 days | Fourth — long-tail review. |
| 5 | 60 days | Stable — caregiver knows this material. |

### Upsert semantics (per ADR 0026 §3)

- **Lesson start** — upsert; on conflict update `last_seen_at` / `updated_at` only.
- **Lesson complete, "Got it"** — `bucket = min(prev + 1, 5)`; `due_at = now + interval[bucket]`; `last_outcome = completed`.
- **Lesson complete, "Revisit"** — `bucket = max(prev − 2, 1)`; `due_at = now + interval[bucket]`; `last_outcome = revisit_requested`. Clamped to bucket 1 minimum so a revisit never schedules sooner than 3 days.

### Retention

Rolling **730 days** on `updated_at` (matches `lesson_progress`'s `started_at` window per [TASK-032](../tasks/TASK-032-privacy-posture-v1.md) posture). Registered in `RETENTION_SCHEDULE` (`packages/db/src/retention/schedule.ts`).

### Why

Closed beta (TASK-036) surfaced re-surface fatigue — caregivers seeing the same lesson within 5 days because the 14-day cooldown loses to stage/topic signals. SRS solves both the fatigue (don't re-show until `due_at`) and the opposite "re-read in two weeks" demand (the `revisit` lever rolls the bucket back to 1). The unit being scheduled is a **lesson card**, not a flashcard; the algorithm is deliberately defensible by hand.

---

## `care_profile_members` (TASK-038 / ADR 0027)

Migration **`0017_family_sharing.sql`**. Drizzle: [`packages/db/src/schema/care-profile-members.ts`](../packages/db/src/schema/care-profile-members.ts). v1 has a parallel section ([`schema-v1.md` § "`care_profile_members`"](schema-v1.md#care_profile_members-and-invite_tokens-task-038)); v2 is the **canonical schema-of-record** going forward.

Household join table: one `users` row may be a member of one (and only one in v1) `care_profile`; one `care_profile` has up to 4 members (`MAX_CO_CAREGIVERS_PER_PROFILE = 3` co-caregivers + 1 owner — see `packages/db/src/schema/care-profile-members.ts`).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | Membership row id. |
| `care_profile_id` | uuid FK → `care_profile(id)` ON DELETE CASCADE | Shared profile. |
| `user_id` | uuid FK → `users(id)` ON DELETE CASCADE, **nullable** | Set when the invite is **accepted**; null while pending. |
| `invitee_email` | text, **nullable** | Lowercased email for **pending** rows (set when `user_id` is null and `role = 'co_caregiver'`). |
| `role` | text CHECK ∈ (`owner`, `co_caregiver`) | Exactly one `owner` per profile (partial unique index below). |
| `invited_by` | uuid FK → `users(id)` ON DELETE CASCADE | The inviter (always the owner in v1). |
| `invited_at` | timestamptz default `now()` | Row creation. |
| `accepted_at` | timestamptz nullable | Non-null when active; the partial state CHECK forbids inconsistent combos. |
| `removed_at` | timestamptz nullable | Soft-remove; excluded from active reads. |
| `share_conversations_with_other_members` | bool default `false` | Future opt-in; v1 UI does not toggle. |
| `share_saved_answers_with_other_members` | bool default `false` | Same. |

**Indexes / constraints**

- `care_profile_members_role_check` — `role` ∈ (`owner`, `co_caregiver`).
- `care_profile_members_state_check` — enforces the three legal states: owner-active, co-caregiver-accepted, co-caregiver-pending. No row can be (e.g.) `accepted_at IS NULL` with a non-null `user_id`.
- `care_profile_members_one_owner_uk` — partial unique on `(care_profile_id)` WHERE `role='owner' AND removed_at IS NULL`. Owners cannot be removed without ownership transfer (out of scope for v1).
- `care_profile_members_active_user_uk` — partial unique on `(care_profile_id, user_id)` WHERE `removed_at IS NULL AND user_id IS NOT NULL`. A user can be a member of a profile only once at a time.
- `care_profile_members_pending_email_uk` — partial unique on `(care_profile_id, invitee_email)` WHERE pending. A given email gets at most one open invite per profile (owner re-sends are revoke + mint, not duplicate).
- `care_profile_members_user_id_idx` — btree on `(user_id)`; hot path for `getCareProfileForUser(userId)`.
- `care_profile_members_care_profile_id_idx` — btree on `(care_profile_id)`; powers the household member list.

**Backfill**: one `owner` row per existing `care_profile`, with `user_id = care_profile.user_id`, `accepted_at = care_profile.created_at`. Idempotent via `WHERE NOT EXISTS` guard.

### Default share-posture (load-bearing)

Copied verbatim from [TASK-038 §2](../tasks/TASK-038-family-sharing-v1.md) and [ADR 0027 §"Default privacy posture"](adr/0027-family-sharing-data-model-and-privacy.md). This table is how the data is **read**, not just stored — duplicating it in the schema doc is intentional per [TASK-043 §"Decisions to make in the PR"](../tasks/TASK-043-schema-v2.md).

| Surface | Default | Rationale |
| --- | --- | --- |
| Care profile (stage, recipient name, situation notes) | **Shared** between members; either can edit; every change writes a `care_profile_changes` row that names the editor (`changed_by`). | The profile is "the plan we built"; shared editing is the whole point. |
| Library catalog | **Shared** read; either can save. (No per-household bookmark table in v1; published modules are global.) | Looking something up should be a household action. |
| Conversation history (`/app/conversation/*`) | **Not shared.** Each caregiver sees only their own threads (`conversations.user_id` gate). | Asking the AI is a private act; many cohort users said this in onboarding free-text. |
| Saved answers ("Things to revisit") | **Not shared** (`saved_answers.user_id`). | Saves are a private bookmark, not a household resource. |
| Lesson progress + SRS schedule | **Per-member.** `lesson_progress` and `lesson_review_schedule` are keyed by `(user_id, module_id)`. | A sibling who already learned bathing-resistance shouldn't have it filtered out for the other. |
| Thumbs-up / thumbs-down (`user_feedback`) | **Per-member.** | Feedback is personal. |
| Transparency page (`/app/help/remembers`) | Lists all co-caregivers by name + email; each member sees only their own preferences. | This is what makes the share posture honest. |

The two boolean columns (`share_conversations_*`, `share_saved_answers_*`) exist so a member can opt **in** in a future ticket. v1 ships them defaulted false; **loosening the default requires a new ADR**, not a silent flag flip (ADR 0027).

### Retention

`active_lifetime` — rows live as long as the household exists. Soft-removed members keep their attribution in `care_profile_changes` (per [ADR 0021](adr/0021-privacy-retention-export-delete.md) audit-trail posture); hard delete only follows the cascading user/profile delete path.

### Why

Sprint 4 cohort feedback showed ~40% of caregivers mentioning a second caregiver (sibling, spouse), and several were creating duplicate profiles to work around it — fragmenting the data we need for retention metrics and SRS. The join table lets a household share one profile while keeping conversation data private by default.

---

## `invite_tokens` (TASK-038 / ADR 0027)

Migration **`0017_family_sharing.sql`**. Drizzle: [`packages/db/src/schema/invite-tokens.ts`](../packages/db/src/schema/invite-tokens.ts). v1 has a parallel section; v2 is the canonical version.

Single-use tokens that unlock a pending `care_profile_members` row when the invitee accepts. The **raw token is never stored** — only its SHA-256 hex digest. The raw value is delivered exactly once via the invite email link and discarded.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | Token row id. |
| `care_profile_member_id` | uuid FK → `care_profile_members(id)` ON DELETE CASCADE | The pending membership this token unlocks. |
| `token_hash` | text | SHA-256 hex of the opaque random secret. |
| `personal_message` | text nullable | Optional invite note for the email body (when the email path lands). |
| `created_at` | timestamptz default `now()` | Mint time. |
| `expires_at` | timestamptz NOT NULL | TTL — **7 days** strawman per ADR 0027 §3. |
| `consumed_at` | timestamptz nullable | Set on accept; subsequent attempts 404. |

**Indexes**

- `invite_tokens_member_created_idx` — `(care_profile_member_id, created_at DESC)`. Powers the "show me the latest token for this pending member" query and the resend-after-24h gate (owner can resend only once per 24h).
- `invite_tokens_token_hash_active_idx` — partial btree on `(token_hash)` WHERE `consumed_at IS NULL`. Lookup path for `/invite/[token]` accept.

### Lifecycle states

```
mint  ─►  active  ─►  consumed   (terminal; row retained 30 days post-consumption)
                  └─►  expired   (passive; pruned daily)
                  └─►  revoked   (active row deleted by resend; new token minted)
```

### Retention

- Consumed tokens: 30 days post-consumption (audit window for "who joined when").
- Unconsumed expired tokens: pruned daily (no operational value).

(Retention enforced by a follow-up cron; the rule is recorded in §"Retention table" below.)

### Why

A pending member needs an opaque, time-bounded handle that lets the invitee accept without a Cognito account-existence check at invite time. Hashing the token at rest means a database-only leak does not let an attacker accept invites; single-use semantics + 7d TTL bound the blast radius if a link is forwarded.

---

## `safety_ft_shadow_decisions` (TASK-039 / ADR 0028)

Migration **`0019_safety_ft_shadow_decisions.sql`**. Drizzle: [`packages/db/src/schema/safety-ft-shadow-decisions.ts`](../packages/db/src/schema/safety-ft-shadow-decisions.ts).

Append-only shadow-mode comparison: when `SAFETY_FT_SHADOW=1`, every Layer-B classifier call runs both the existing zero-shot Haiku path **and** the fine-tuned Bedrock custom model in parallel. The user-visible decision still comes from zero-shot; this table records both verdicts and their latencies for offline comparison and the gate evaluation in [ADR 0028 §"Decisions" 5](adr/0028-fine-tuned-safety-classifier.md). **No raw text is ever stored** (per [ADR 0021](adr/0021-privacy-retention-export-delete.md)) — only a `text_hash`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | Row id. |
| `request_id` | uuid NOT NULL | The originating RAG request id; lets us join back to logs. |
| `text_hash` | text NOT NULL | SHA-256 of the user input — used to dedupe in disagreement review without storing the input. |
| `zero_shot_verdict` | jsonb NOT NULL | `{ triaged, category?, severity? }` — the live decision. |
| `fine_tuned_verdict` | jsonb NOT NULL | Same shape — the shadow decision. |
| `zero_shot_latency_ms` | int NOT NULL | Wall-clock latency of the Haiku call. |
| `fine_tuned_latency_ms` | int NOT NULL | Wall-clock latency of the FT call; gate target ≤ 60% of `zero_shot_latency_ms` P95. |
| `observed_at` | timestamptz default `now()` | Insertion time; the prune cron's date column. |

**Indexes**

- `safety_ft_shadow_observed_at_idx` — `(observed_at DESC)`. Powers the rolling-7-day stats panel at `/internal/safety` and the 30-day prune.

### Retention

**30 days** rolling on `observed_at` per ADR 0028 §6. Pruned by `POST /api/cron/safety-ft-shadow-prune` (same `CRON_SECRET` pattern as the feedback-SLA cron).

### Why

The fine-tuned classifier is a recall-floor change; we will not flip `SAFETY_FT_LIVE=1` until ≥ 7 days of shadow data and ≥ 1000 logged decisions show the FT path matches or beats zero-shot on the three crisis buckets at 100% recall and on overall accuracy at ≥ 90%. The shadow table is the gate's input.

---

## `model_routing_decisions` (TASK-042 / ADR 0030)

Migration **`0021_model_routing.sql`**. Drizzle: [`packages/db/src/schema/model-routing-decisions.ts`](../packages/db/src/schema/model-routing-decisions.ts).

Append-only Layer-5 routing audit: when `MODEL_ROUTING=1`, every grounded-answer turn writes one row recording the inputs and outputs of `selectModel()`. Used by `/internal/metrics` for the per-cohort A/B comparison tile and by the 14-day "did treatment win?" review.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | Row id. |
| `message_id` | uuid FK → `messages(id)` ON DELETE CASCADE | The assistant turn this decision routed (1:0..1 — refusal-path turns may not have a row). |
| `user_id` | uuid FK → `users(id)` ON DELETE CASCADE | The asking user; powers per-user backfills if needed. |
| `cohort` | text CHECK ∈ (`routing_v1_control`, `routing_v1_treatment`) | Sticky per user; mirrors `users.routing_cohort`. |
| `classifier_verdict` | jsonb NOT NULL | Snapshot of `{ topic, urgency, stage, is_refusal_template }` from `buildClassifierVerdictForRouting()` (ADR 0030 §2). |
| `policy_version` | int NOT NULL | The `policy_version` from `model-routing.yaml` at the time of the call. |
| `matched_rule` | int nullable | Index into `policy.routes`; null when the default fired. |
| `model_id` | text NOT NULL | The Bedrock model id ultimately invoked. |
| `reason` | text NOT NULL | Human-readable reason from the matched rule (or "default tier" / "control cohort"). |
| `latency_ms` | int nullable | Generation latency; filled in post-stream. |
| `tokens_in` / `tokens_out` | int nullable | From the Bedrock invoke response; the inputs to `cost_estimate_usd`. |
| `cost_estimate_usd` | numeric(10, 6) nullable | Order-of-magnitude estimate from `tokens × bedrock-pricing.ts`; **not billing**. |
| `created_at` | timestamptz default `now()` | Insertion time; the prune cron's date column. |

**Indexes**

- `model_routing_decisions_user_created_idx` — `(user_id, created_at DESC)`. Per-user lookup and privacy export.
- `model_routing_decisions_created_idx` — `(created_at)`. Powers the rolling 90-day prune.

### Cost-estimate methodology

Lives in [ADR 0030 §"Decisions" 5](adr/0030-per-user-model-routing.md) and `packages/model-router/src/bedrock-pricing.ts`. **Not embedded here** so a Bedrock pricing change does not require a schema-doc edit. The formula is approximately `(tokens_in × input_price_per_1k + tokens_out × output_price_per_1k) / 1000` against the model id's tier.

### Retention

**90 days** rolling on `created_at`, matching `safety_flags`-class telemetry per [ADR 0021](adr/0021-privacy-retention-export-delete.md). Registered in `RETENTION_SCHEDULE`. Optional manual helper: `packages/db/scripts/prune-model-routing-decisions.sql`.

### Why

Three reasons (TASK-042 "Why this exists"): the cohort surfaced a quality gap on medical questions that Opus closes; refusal-template paths shouldn't pay Sonnet pricing for templated output; and the table sets up the data for richer per-user routing in Sprint 6 without re-architecting Layer 5.

---

## Column additions

### `user_feedback.safety_relabel` (TASK-039 / ADR 0028)

Migration **`0019_safety_ft_shadow_decisions.sql`**. Nullable `text` with a CHECK constraint pinning values to the red-team bucket vocabulary:

```
safety_relabel IS NULL OR safety_relabel IN (
  'crisis_self_harm',
  'crisis_recipient_safety',
  'crisis_external',
  'gray_zone',
  'safe_self_care',
  'safe_factual'
)
```

Populated by the Care Specialist via `/internal/feedback` for thumbs-down rows whose originating turn had a `safety_flags` entry. Drives Stream B of the fine-tune training corpus (TASK-039 §1 Stream B).

> **Naming note (TASK-043 Q2):** the ticket asks whether to rename to `safety_relabel_bucket` for clarity. Trivially renameable now (column was added in TASK-039); painful to rename later. Open for PM call — not renamed in this PR.

> **Note on table name:** the TASK-043 ticket refers to this column as `feedback.safety_relabel`; the actual table is `user_feedback` (see [`schema-v1.md` § "`user_feedback`"](schema-v1.md#user_feedback-task-036)).

### `users.routing_cohort` (TASK-042 / ADR 0030)

Migration **`0021_model_routing.sql`**. Nullable `text` (no CHECK; values asserted in application code):

```
'routing_v1_control' | 'routing_v1_treatment' | NULL
```

Backfilled deterministically 50/50 per user id:

```sql
UPDATE users
SET routing_cohort = CASE
  WHEN get_byte(sha256(convert_to(id::text, 'UTF8')), 0) % 2 = 0
    THEN 'routing_v1_control'
  ELSE 'routing_v1_treatment'
END
WHERE routing_cohort IS NULL;
```

Re-runnable; new users get assigned at first sign-in via `routingCohortFromUserId` in `packages/model-router`. Cohort is **sticky** — never re-randomized — so the A/B comparison is not contaminated by mid-experiment reassignment.

---

## Deprecation: `care_profile.user_id`

`care_profile.user_id` (since pre-Sprint-1; documented in [`schema-v0.md`](schema-v0.md)) is **deprecated** in favor of `care_profile_members` after TASK-038.

**Status during Sprint 5:**

- The column **still exists** and is **still populated** by legacy write paths (e.g. backfill for owner membership rows uses it as the source of truth).
- All read paths in Sprint 5 — including `getCareProfileForUser` — read from `care_profile_members`. `care_profile.user_id` is **not read** by application code post-TASK-038 merge.
- The owner's identity is the `care_profile_members` row with `role = 'owner'` and `removed_at IS NULL` (enforced by the `care_profile_members_one_owner_uk` partial unique index).

**Sprint 6 removal plan:**

A follow-up ticket will drop `care_profile.user_id` after a verification window that confirms zero application reads. The verification is a one-line query log search across the period (CloudWatch Logs Insights filter on `care_profile.user_id` references). The drop migration:

1. Confirms every `care_profile` row has exactly one `care_profile_members` owner row (`SELECT … HAVING count(*) <> 1` returns no rows).
2. Drops the column.
3. Drops the FK constraint, if any references remain.

This ticket (TASK-043) **documents** the deprecation; it does **not** drop the column.

---

## Sprint 5 ancillary tables and latent gaps

These three tables exist in the Drizzle schema but were never given full schema-doc sections. The [`schema-doc-coverage`](../packages/db/test/schema-doc-coverage.test.ts) test (TASK-043 §"Tests") would otherwise fail; documenting them here closes the gap. Per [TASK-043 Q4](../tasks/TASK-043-schema-v2.md), surfacing latent gaps is in scope; full prose-explained sections for the older tables can come in a follow-up if PM wants.

### `lesson_stream_telemetry` (TASK-040 / ADR 0029)

Migration **`0022_lesson_stream_telemetry.sql`**. Drizzle: [`packages/db/src/schema/lesson-stream-telemetry.ts`](../packages/db/src/schema/lesson-stream-telemetry.ts).

One row per **successful** SSE lesson stream. Powers the lesson-stream-latency tile on `/internal/metrics`. Columns: `id`, `user_id` (FK), `module_id` (FK), `first_card_ms`, `done_ms`, `card_count`, `created_at`. Index on `created_at`.

**Retention:** 365 days rolling on `created_at`.

### `library_search_streams` (TASK-041 / ADR 0029)

Migration **`0020_library_search_streams.sql`**. Drizzle: [`packages/db/src/schema/library-search-streams.ts`](../packages/db/src/schema/library-search-streams.ts).

One row per completed library SSE search. Counts and latency only — **no query text** ([CLAUDE.md](../CLAUDE.md) "Database" note for TASK-041). Columns: `id`, `user_id` (FK), `started_at`, `first_result_at`, `done_at`, `query_length`, `candidate_count`, `result_count`. Index on `started_at`.

**Retention:** registered as the streaming-telemetry default; see `RETENTION_SCHEDULE`.

### `user_suppression` (TASK-025 / ADR 0015) — latent gap

Migration **`0007_user_suppression_and_flag_dedupe.sql`**. Drizzle: [`packages/db/src/schema/user-suppression.ts`](../packages/db/src/schema/user-suppression.ts).

24h in-app feature suppression after caregiver-distress triage (PRD §10.3). PK `user_id` (FK to `users`); columns `until` (timestamptz), `reason` text CHECK ∈ (`caregiver_self_harm`, `elder_abuse_or_caregiver_breaking_point`), `set_at` (timestamptz). Surfaced now because the coverage test would otherwise fail.

**Retention:** 30 days rolling on `set_at`.

---

## Hermes heavy modules (TASK-044 / migration `0023_heavy_modules.sql`)

Wave-1 **heavy** library modules ship as a **directory bundle** on disk (`content/modules/<slug>/`: `module.md`, `branches/*.md`, `tools/*.json`, `evidence.json`, `relations.json`) and are loaded by `@alongside/content` (`pnpm --filter @alongside/content load -- --heavy <slug>`) or published via JSON through `POST /api/internal/content/publish-bundle`. Drizzle lives under `packages/db/src/schema/module-*.ts` (plus extended `modules` / `module_evidence`). Contract reference: [ADR 0031](adr/0031-hermes-disk-bundle-and-module-tools-jsonb.md); operator steps: [heavy-modules-runbook.md](heavy-modules-runbook.md).

### `modules` (heavy columns)

Migration adds nullable / defaulted columns used only when `heavy = true`: `heavy`, `bundle_version`, SRS scheduling hints (`srs_interval_days`, `srs_difficulty_bucket`, `srs_initial_ease_factor`), JSON/topic arrays (`primary_topics`, `secondary_topics`, `clinical_substrate`, `lived_experience_passages`, `synthesis_notes`), and optional `brief_path` / `critique_path` pointers. Existing light modules keep `heavy` false and prior behavior.

### `module_branches`

One row per **care-profile axis tuple** for a heavy module: `stage_key`, `relationship_key`, `living_situation_key` (each `text`, including literal `any` for fallbacks), plus `body_md` (markdown shown when this branch wins `selectHeavyBranchMarkdown`). Unique on `(module_id, stage_key, relationship_key, living_situation_key)`.

### `module_branch_chunks` (migration `0024_module_branch_chunks.sql`)

Vector **RAG chunks for branch bodies**: each row is a slice of a `module_branches.body_md` embedding, keyed by `module_id` + `branch_id` + `chunk_index`. Columns mirror `module_chunks` in spirit: `content`, `token_count`, `embedding` (`vector(1024)`), `metadata` (jsonb — includes `branch_key` and axis keys for retrieval fit). Unique on `(module_id, branch_id, chunk_index)`. Written at heavy **publish** time alongside `module_branches` inserts; consumed by `packages/rag` merged search with canonical `module_chunks`.

### `module_tools`

Structured tools keyed by `slug` + `tool_type` (`checklist`, `decision_tree`, `script`, `template`, `flowchart`, …); full JSON from disk is stored in **`module_tools.payload` (jsonb)** after Zod validation in `@alongside/content`.

### `module_evidence`

Evidence rows keyed by `claim_anchor` (e.g. `[1]`); migration extends rows with `quoted_excerpt`, optional `url_snapshot`, and `claim_anchor` alignment to the markdown citation set.

### `module_relations`

Directed edges from the owning module to another **`modules.slug`**: `to_module_slug`, `relation_type` (`prerequisite`, `follow_up`, `deeper`, `contradicts`, `soft_flag_companion`), optional `rationale`. Publish path may optionally insert **stub** target modules when `--seed-relation-targets` is used on the CLI (internal HTTP publish defaults to `false`).

**Retention:** follow the same posture as `modules` / library catalog content (no separate rolling window in `RETENTION_SCHEDULE` for these child tables in v1).

---

## Relationships (v2 update)

Updates the relationship subsection from [`schema-v1.md`](schema-v1.md). v1's diagram still applies for the v0/v1 surface; the additions below describe the Sprint 5 deltas.

- A `users` row can be a member of **zero or one** `care_profile` (multi-membership not supported in v1; `getCareProfileForUser` throws `MultipleProfilesNotSupportedError` if it finds more than one accepted membership). Documented here for the future when multi-recipient households become supported.
- A `care_profile` has **1..4** members (cap from `MAX_CO_CAREGIVERS_PER_PROFILE = 3` co-caregivers + owner); **exactly one** with `role = 'owner'` at any time, enforced by `care_profile_members_one_owner_uk`.
- A `messages` row may have a `model_routing_decisions` row (**1:0..1**); routing is recorded post-stream and may be **absent** for refusal-path turns (Layer 2 triage and Layer 4 grounding-fail bypass Layer 5; see [ADR 0008](adr/0008-rag-pipeline-v0.md) §5).
- A `user_feedback` row may have a `safety_relabel` value if the originating turn had a `safety_flags` row. `safety_relabel` is null for thumbs-down rows whose original turn never tripped the safety classifier.
- A `lesson_progress` row corresponds to **at most one** `lesson_review_schedule` row per `(user, module)`. The reverse is also true: a schedule row exists only after at least one lesson start; the unique index on `(user_id, module_id)` makes the relationship 1:0..1 in both directions.
- A `care_profile_members` (pending) row has **0..N** `invite_tokens` rows over its lifetime (revoke + mint replaces the active token; older rows linger until the 30-day post-consumption window closes).
- A heavy `modules` row (`heavy = true`) has **1..N** `module_branches` rows (including one `(any, any, any)` fallback), **0..N** `module_branch_chunks` rows (one set per branch after publish-time embed), **0..N** `module_tools`, **0..N** `module_evidence`, and **0..N** `module_relations` edges. Library read picks the highest-specificity branch matching `care_profile` stage / relationship / `living_situation`.

---

## Retention table (consolidated)

Lives below for cross-reference; the source of truth is `RETENTION_SCHEDULE` in [`packages/db/src/retention/schedule.ts`](../packages/db/src/retention/schedule.ts) (covered by `packages/db/test/retention-coverage.test.ts`). If the table below disagrees with the upstream ticket or the schedule constant, **the schedule constant wins** and this doc is patched.

| Table | Retention | Source |
| --- | --- | --- |
| `messages` | 365 days rolling | ADR 0021 / `RETENTION_SCHEDULE` |
| `safety_flags` | 730 days rolling; de-identified on user delete | ADR 0021 |
| `safety_ft_shadow_decisions` | **30 days** rolling on `observed_at` | ADR 0028 |
| `model_routing_decisions` | **90 days** rolling on `created_at` | ADR 0021 (matched), ADR 0030 (justified) |
| `user_feedback` | indefinite (PII redacted per ADR 0021) | TASK-036 |
| `lesson_review_schedule` | 730 days rolling on `updated_at` (no PII) | ADR 0026 / TASK-032 posture |
| `lesson_progress` | 730 days rolling on `started_at` | TASK-032 |
| `care_profile_members` | active_lifetime | ADR 0027 |
| `invite_tokens` (consumed) | 30 days post-consumption | ADR 0027 |
| `invite_tokens` (unconsumed expired) | pruned daily | ADR 0027 |
| `lesson_stream_telemetry` | 365 days rolling on `created_at` | TASK-040 |
| `library_search_streams` | streaming-telemetry default (see `RETENTION_SCHEDULE`) | TASK-041 |
| `user_suppression` | 30 days rolling on `set_at` | ADR 0015 |

---

## Schema-of-record version

**Schema v2 is the current schema-of-record as of Sprint 5.** v1 (`docs/schema-v1.md`) and v0 (`docs/schema-v0.md`) remain accurate snapshots of their respective sprints; v2 extends them additively. Sprint 6 may either continue to extend v2 or fork to v3 if v2 grows past ~600 lines (same convention as v1→v2 in [`TASKS.md`](../TASKS.md) §"Sprint 4 quality gates"; updated for v2 in `CONTRIBUTING.md`).
