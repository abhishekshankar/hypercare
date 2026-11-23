# ADR 0027 — Family sharing v1 (data model + default privacy)

**Status:** Accepted (implementation in progress alongside TASK-038)  
**Implements:** [TASK-038](../../tasks/TASK-038-family-sharing-v1.md)

## Context

Sprint 4 beta showed caregivers duplicating care profiles for siblings or spouses. v1 introduces multiple caregivers on a single care recipient while keeping conversation data private by default.

## Decision

1. **Membership model** — Table `care_profile_members` links `users` to a shared `care_profile`. Each row has `role` ∈ {`owner`, `co_caregiver`}. Pending invites use `invitee_email` + null `user_id` until acceptance (the ASCII schema in the ticket omits this; we document it here explicitly).

2. **Exactly one owner** per `care_profile_id` at a time — Enforced with a partial unique index on `(care_profile_id)` where `role = 'owner'` and `removed_at` is null.

3. **Invite tokens** — Table `invite_tokens` stores a SHA-256 hash of a random opaque token, keyed to the pending `care_profile_members` row. Single-use via `consumed_at`. Default TTL **7 days** (strawman from the ticket).

4. **Audit** — `care_profile_changes` gains `changed_by` (editor). Historic rows backfill from `user_id`. Read paths that aggregate household activity use `changed_by` + household membership to show who edited what (TASK-033 / profile surfaces).

5. **Default privacy posture** — Matches TASK-038 §2:

| Surface | Default |
| --- | --- |
| Care profile | Shared; any accepted member may edit |
| Library catalog | Global published modules (unchanged); no per-household bookmark table in v1 |
| Conversations & saved answers | Still scoped by `conversations.user_id` / `saved_answers.user_id` — **not** shared |
| Lesson progress & SRS | Per `user_id` — **not** shared |

Opt-in columns `share_conversations_with_other_members` and `share_saved_answers_with_other_members` default **false**; no UI in v1.

6. **Transactional email** — Production invite email is expected to reuse Cognito’s transactional sender per `docs/auth-runbook.md`. Until that wiring lands, dev can mint tokens via the API and copy an accept URL (engineering note; PM copy TBD).

## Privacy / PM sign-off

**Privacy reviewer sign-off:** _Pending_ — fill before enabling invite emails in production.

Loosening the default “conversations not shared” posture requires a **new ADR**, not a silent flag flip.

## Consequences

- Migrations **0017_family_sharing** (after **0016_lesson_review_schedule**) creates tables, backfills owner membership rows, and adds `changed_by`. Column-level reference: [`docs/schema-v1.md`](../schema-v1.md) § `care_profile_members` and `invite_tokens`.
- Read paths resolve “this user’s care profile” via `getCareProfileForUser` (throws `MultipleProfilesNotSupportedError` if a user has more than one accepted membership — intentionally unsupported in v1).
- Co-caregivers must not create a second `care_profile` row; onboarding step 1 short-circuits when an accepted membership exists.

## Follow-ups (out of TASK-038 scope or later PRs)

- `/app/profile/family`, `/invite/[token]` UX, Cognito-driven email, resend-after-24h, member cap enforcement in the UI, E2E specs in the ticket.
- Privacy export should attach household membership metadata for co-caregivers (currently export still keys `care_profile` off primary `user_id` only).

---

Schema documented in [`docs/schema-v2.md`](../schema-v2.md) § `care_profile_members` and § `invite_tokens`; v1 entries preserved at [`docs/schema-v1.md`](../schema-v1.md). (TASK-043.)

