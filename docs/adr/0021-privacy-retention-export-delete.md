# ADR 0021 — Privacy: retention, export, and account delete (TASK-032)

## Status

Accepted

## Context

Closed beta needs named retention, self-serve export, and account deletion before cohort agreements. The PRD (§10, §14) and safety work require **not** hard-deleting `safety_flags` so the weekly review loop can learn from classifier misses, while the care partner must be able to leave the system.

## Decision

1. **Retention**
   - Every application table is listed in `packages/db/src/retention/schedule.ts` with either `active_lifetime` (no rolling purge while the system owns the data) or `rolling` with a `days` window. CI / tests compare this map to the live public table list when `DATABASE_URL` is set.
   - Windows use the column in the `RETENTION_RULE` (usually `created_at`). Exceptions: `conversation_memory.last_refreshed_at`, `user_sessions.visited_at`, `user_suppression.set_at`, `user_auth_sessions.last_seen_at`, `session_revocations.revoked_at`.
   - A daily **retention cron** (`pnpm --filter @hypercare/db retention:cron`) performs deletes; first production run should be dry-run, then enabled on a schedule (recommend: EventBridge → Lambda; implementation is ops-owned).

2. **Export**
   - `POST /api/app/privacy/export` rate-limits to one completed export per user per 24h.
   - Work runs when `GET /api/app/privacy/export/status` is polled for a `pending` row; the artifact is a ZIP with `hypercare_export.json`, stored in S3 with a presigned download URL. Env: `PRIVACY_EXPORT_S3_BUCKET`, `AWS_REGION` (or default).

3. **Account delete**
   - In one transaction: de-identify `safety_flags` (null `user_id` / `message_id` / `conversation_id`, clear `last_message_text` PII using email, care-recipient first name, phone regex), set `deidentified_at`, then delete all other user-scoped rows, revoke sessions, insert `admin_audit`, delete `users`.
   - PII in `message_text` is **not** removed (needed for triage); `last_message_text` is stripped. Rationale: balance clinician review and privacy; regex strip is logged in audit `meta` for operator deletes when needed.

4. **Sessions**
   - `hc_session` uses **14 days** idle and **90 days** absolute, keyed by `iat` in the signed payload: `exp = min(iat+90d, now+14d)`.
   - `user_auth_sessions` rows (per cookie `sid`) support device list; `session_revocations` invalidates a `sid` before signature expiry. Middleware still checks only signature+exp; API/RSC `getSession()` enforces revocations and touches `last_seen_at`.

5. **Admin parity**
   - `pnpm --filter @hypercare/db admin:forget` runs the same `deleteUserAccount` function with `source: "admin_cli"` and a `reason` string in audit `meta`.

## Consequences

- Schema migration adds `safety_flags.deidentified_at`, `user_auth_sessions`, `session_revocations`, `privacy_export_requests`, and relaxes `admin_audit.user_id` to nullable with `ON DELETE SET NULL` so post-delete events survive.
- S3 and AWS credentials are required for export in real environments; local dev can leave bucket unset (export returns 503).
- Legal must still approve the three copy blocks (profile table, delete modal, mandatory-reporter line); PM links approval in the PR.
