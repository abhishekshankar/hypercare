# TASK-032 — Privacy posture v1: retention, export, delete

- **Owner:** Cursor (PM owns the legal review of the copy)
- **Depends on:** TASK-019 (schema v1 is where retention fields land), TASK-020 (profile editor is the natural host for "Download / Delete my data"), TASK-029 (admin audit table — delete events audit through it)
- **Unblocks:** paid / broader rollout beyond closed beta; compliance for any partnership (Alzheimer's Association chapters, geriatric practices) where HIPAA-adjacent expectations kick in; PRD §14 open question resolution
- **Status:** pending
- **ADR:** `docs/adr/0021-privacy-retention-export-delete.md` (new — retention schedule per table, soft vs hard delete, safety-flag de-identification carve-out, legal-reviewed copy)

---

## Why this exists

PRD §14 names "Privacy posture on the care profile — data retention, export, deletion, and whether any inference is shared across users" as an open question. We deferred it during sprint 1–3 because no real user data was in the system. Sprint 4 runs a closed beta; **the cohort signs an agreement before data collection**, and that agreement needs to name retention windows, export format, and deletion semantics. Ship it before the beta opens.

There's a subtle tension in a product like Hypercare: the PRD is emphatic about safety (§10), and the safety-flag log exists precisely to let clinicians review misses. Full-hard-delete of a user's data would delete safety_flags too, which means we'd lose the ability to detect and learn from classifier misses. The resolution, documented in the ADR and surfaced to users in the delete confirmation copy: **account deletion de-identifies safety_flags (strips user_id, keeps category + message_text + timestamp) rather than destroying them.** The PRD §10.2 weekly-review loop depends on this being non-optional. We're transparent about it in the delete flow.

---

## Context to read first

1. `prd.md` §14 (the open question), §10.2 (safety-flag review cadence — explains why we can't nuke those rows), §5.5 and §5.6 (care profile — what users will reasonably expect to be able to delete).
2. `packages/db/src/schema/*` — every table. Each needs a retention classification.
3. `docs/schema-v0.md`, `docs/schema-v1.md` — the schema docs extend with a retention column per table.
4. `docs/infra-runbook.md` — add retention cron operational notes.
5. `apps/web/src/app/(authed)/app/profile/` — where the "Download / Delete my data" buttons will live.
6. Any existing cookie / auth session metadata — `hc_session` from ADR 0004 lives for a TTL already; this ticket makes the TTL and the revocation story explicit.

---

## What "done" looks like

### 1. Retention schedule

Codified in `packages/db/src/retention/schedule.ts` as a typed map:

```ts
export const RETENTION_SCHEDULE: Record<TableName, RetentionRule> = {
  users:                  { kind: 'active_lifetime' },
  care_profile:           { kind: 'active_lifetime' },
  care_profile_history:   { kind: 'active_lifetime' },     // change-log
  conversations:          { kind: 'rolling', days: 365 },  // 1 year
  messages:               { kind: 'rolling', days: 365 },
  conversation_memory:    { kind: 'rolling', days: 90 },   // regenerates; 90d is plenty
  saved_answers:          { kind: 'active_lifetime' },     // user-elected persistence
  lesson_progress:        { kind: 'rolling', days: 730 },  // 2 years
  weekly_checkins:        { kind: 'rolling', days: 730 },
  safety_flags:           { kind: 'rolling', days: 730, deidentify_on_user_delete: true },
  admin_audit:            { kind: 'rolling', days: 365 },
  user_sessions:          { kind: 'rolling', days: 90 },   // TASK-029 log
  user_suppression:       { kind: 'rolling', days: 30 },   // 24h windows; 30d buffer
  modules:                { kind: 'active_lifetime' },
  module_chunks:          { kind: 'active_lifetime' },
  module_versions:        { kind: 'active_lifetime' },
  module_briefs:          { kind: 'active_lifetime' },
  module_evidence:        { kind: 'active_lifetime' },
  module_reviews:         { kind: 'active_lifetime' },
  topics:                 { kind: 'active_lifetime' },
};

type RetentionRule =
  | { kind: 'active_lifetime' }                          // kept while user exists
  | { kind: 'rolling'; days: number; deidentify_on_user_delete?: true };
```

Anything added by a future migration must add its entry here or CI fails. A new `packages/db/test/retention-coverage.test.ts` introspects the schema and asserts every table is accounted for.

### 2. Retention cron

A daily job (`packages/db/src/scripts/retention-cron.ts`) runs via a scheduled Lambda or Amplify scheduled task (decide in ADR; my vote: EventBridge scheduled rule → Lambda, defined in CDK under `infra/`):

- For each table with a `rolling` rule, delete rows where `created_at < now() - interval 'N days'`.
- Log per-table rowcount deleted.
- Emit a CloudWatch metric `retention.rows_deleted{table=…}`.
- Dry-run flag (`--dry-run`) used by PM in the verification step.

First run is **manual** (PM invokes) after deploy; scheduled rule enables on day 2. ADR explains the phased enablement.

### 3. Self-serve data export

`/api/app/privacy/export` (POST; session required; rate-limited to 1 per user per 24h):

- Assembles a JSON payload: care_profile + care_profile_history + conversations + messages (with citations and refusal) + saved_answers + lesson_progress + weekly_checkins + conversation_memory + safety_flags (user's own only) + user row (email, created_at, stage).
- Zips it.
- Writes to S3 under a short-TTL prefix (7 days), returns a presigned URL. Do **not** attach the file to the response — large, and the request can timeout.
- UI on `/app/profile`: a "Download my data" button. On click → POST → "We're preparing your data — you'll see a download link on this page in a minute." Poll `/api/app/privacy/export/status` for the URL. When ready, present a "Download" link (the presigned URL, opens in browser).
- Export rows are identified by internal UUIDs; we don't expose any AWS/internal identifiers.
- Audit: one `admin_audit` row per export request (user self-audit).

### 4. Self-serve account delete

`/api/app/privacy/delete` (POST with an idempotency key; session required; requires a second confirmation):

- UI flow on `/app/profile`:
  1. "Delete my account" button → modal.
  2. Modal content (legal-reviewed copy; see §6):
     - "This deletes your care profile, conversations, saved answers, lesson progress, and check-ins."
     - "Anonymized safety flags from your conversations are kept for 2 years so clinicians can review and improve the product's crisis response. These rows will no longer be linked to you after delete — they carry the message text, category, and timestamp, not your identity."
     - "This cannot be undone."
  3. Type your email to confirm.
  4. Click "Permanently delete."
- Server:
  1. Within a single transaction: for each user-scoped table with `kind: 'rolling'` or `kind: 'active_lifetime'`, delete where `user_id = :id`, EXCEPT safety_flags (see below).
  2. For `safety_flags`: UPDATE to set `user_id = NULL`, `conversation_id = NULL`, and null out `last_message_text` if it contains PII markers (regex pass — names from the care_profile, email addresses, phone numbers). The core row — category, message_text (untouched, intentionally), severity, source, created_at — remains.
  3. Delete the `users` row last.
  4. Invalidate all `hc_session` cookies for the user via the session store.
  5. Write an `admin_audit` row with `path: '/api/app/privacy/delete'`, `user_id: <original>`, `at: now()`. (Yes, we keep the audit of the delete event itself.)
- Response: 200 + clears cookie. Redirect to `/` with a "your account has been deleted" banner.
- Irreversibility: no soft-delete; no 30-day grace; no undo. Document explicitly in the copy.

### 5. Session TTL + revocation

- Codify `hc_session` TTL: 14 days idle, 90 days absolute. Already partially shipped via ADR 0004; this ticket makes the numbers explicit and ships a `session_revocations(session_id, revoked_at, reason)` table so delete/logout/compromised-session flows have a uniform revocation path.
- Add `/api/app/privacy/sessions` — list active sessions for the current user, each with last-seen and IP-country (not full IP), and a "revoke" button. PRD scope creep check: this is essential for a trust-building privacy surface and it's cheap once revocations exist.
- Audit: revocations write to `admin_audit`.

### 6. Legal-reviewed copy (PM owns)

PM routes three strings through legal before merge:

1. **Retention summary**, rendered on `/app/profile` → "What we keep, and for how long." A table summarizing the `RETENTION_SCHEDULE` in plain English.
2. **Delete confirmation modal copy** (see §4 wording above — legal adjusts).
3. **Mandatory-reporter disclosure** — the placeholder in TASK-025's elder-abuse script. Legal provides the final wording; Cursor edits the .md file and bumps `reviewed_on`.

Legal sign-off is a merge blocker. The PR description has a checkbox: "legal approved — link to the approval thread."

### 7. Admin "forget" for operator-driven deletes

Beta / GDPR-adjacent requests sometimes come to ops, not through the UI. A CLI (`packages/db/src/scripts/admin-forget.ts --user-id=<uuid> --reason=<string>`) runs the same delete transaction, under an admin identity. Writes to `admin_audit` with `reason` populated. No new code path — wraps the same function the API route uses.

---

## Schema additions

```
ALTER TABLE safety_flags ADD COLUMN deidentified_at timestamptz;
   -- null until delete; when a user is deleted, set to now() and null user_id / conversation_id.

CREATE TABLE session_revocations (
  session_id text primary key,
  user_id uuid,           -- null if the user is already deleted
  revoked_at timestamptz not null default now(),
  reason text not null check (reason in ('logout','user_delete','admin_revoke','ttl'))
);
```

Document in `docs/schema-v1.md`.

---

## Tests

- Unit (`packages/db/test/retention-coverage.test.ts`): every schema table is in `RETENTION_SCHEDULE`; new tables fail the test until added.
- Unit (`packages/db/test/retention-cron.test.ts`): for a rolling(30) table, rows older than 30d deleted; newer kept; dry-run emits counts without deleting.
- Unit (`packages/db/test/delete.test.ts`): given a seeded user with rows in every user-scoped table, delete leaves zero user-scoped rows EXCEPT safety_flags (de-identified); users row gone; session revoked; admin_audit has the delete event.
- Integration (`apps/web/test/api/privacy-export.test.ts`): POST → zip lands in S3 → presigned URL fetches → unzip contains the expected JSON files; a second POST within 24h returns 429.
- Integration (`apps/web/test/api/privacy-delete.test.ts`): full flow including the email-type-to-confirm + cookie clear.
- E2E (`apps/web/test/e2e/privacy.spec.ts`):
  1. Log in, hit `/app/profile` → "Download my data" → wait → download → open zip → spot-check.
  2. "Delete my account" → modal → type wrong email → button disabled. Type correct → delete → redirect → cannot log back in.
  3. `psql` shows the deleted user's safety_flags with `user_id IS NULL`, `deidentified_at` set, and the core fields preserved.

---

## Acceptance criteria

- `RETENTION_SCHEDULE` covers every table; CI fails on missing coverage.
- Retention cron runs in dry-run cleanly; real run deletes the right rows for a seeded fixture.
- Export + delete both self-serve from `/app/profile`, with legal-reviewed copy.
- Delete de-identifies safety_flags rather than deleting them; this behavior is named in the confirmation modal.
- Sessions list + revoke works; `/api/app/privacy/sessions` returns the user's own sessions.
- The admin CLI runs the same delete flow under an operator identity; writes `admin_audit`.
- Legal approval is linked in the PR description. Mandatory-reporter disclosure in TASK-025's elder-abuse script replaced with the final legal wording; `reviewed_on` bumped; manifest updated.
- ADR 0021 written.
- `pnpm lint typecheck test` green; eval doesn't regress.

---

## Out of scope

- GDPR-style right to rectification via API (users edit their care profile; that's rectification). No separate API.
- HIPAA compliance. Hypercare is not a covered entity in v1. PRD §3.2 explicit non-goal. Legal confirms the beta terms.
- SOC 2 controls. Year-2 conversation.
- Third-party data processor list / sub-processor disclosure. Shipped as a copy-only addition to the privacy page; no automation.
- Regional data residency (EU data in EU). US-only v1.
- Retention override per-user (e.g., a user requesting 30-day retention). Uniform schedule; exceptions are manual.
- Transparency report / aggregate disclosure counts. Nice for year 2.

---

## Decisions to make in the PR

- **Rolling-window definition.** `created_at < now() - interval 'N days'` or `updated_at`? My vote: `created_at` uniformly. Records are rarely updated; simpler semantics.
- **Session TTL values.** 14 / 90. Legal may push on these.
- **Export rate limit.** 1 per 24h feels safe; too high triggers S3 cost. My vote: 1 per 24h, overridable by admin.
- **Safety-flag message text after de-identification.** I said "keep untouched" above. This is a judgment call: the message text may contain a real caregiver's private sentence. Alternative: regex-strip obvious PII (names from the care profile, email/phone). My vote: regex-strip on de-identification; log what we stripped in the audit. ADR records the rationale.

---

## Questions for PM before starting

1. **Legal timeline.** I need the copy reviewed mid-sprint to avoid blocking merge. Who owns the legal relationship and what's the SLA?
2. **Mandatory-reporter wording.** Legal's final version or a continued placeholder? If legal can't ship in-sprint, we keep the placeholder and defer to sprint 5 — but the self-serve delete + retention schedule don't depend on it.
3. **"Forget about me" subtlety.** Should the care-profile delete also propagate a "forget" to the topic classifier's training set (if any) and to the conversation-memory refresh cache? My vote: yes, TASK-027's memory deletion is already handled by FK cascade via `conversations`; confirm no stale memory survives.
4. **Retention cron runner.** EventBridge + Lambda is my vote. Alternative: a small container on Amplify. Pick one in ADR.

---

## How PM verifies

1. Log in, go to `/app/profile`, see the "What we keep" table. Readable.
2. "Download my data" → wait 30s → download → open the zip → spot-check five files.
3. "Delete my account" → modal → wrong email → button disabled. Correct email → delete. Can't log back in.
4. `psql -c "select count(*) from safety_flags where user_id is null and deidentified_at is not null;"` — shows the de-identified rows.
5. `pnpm --filter @hypercare/db retention:cron --dry-run` — non-destructive summary.
6. `/api/app/privacy/sessions` lists the current session; revoke it; next request 401s.
7. Read ADR 0021. Confirm legal approval linked in the PR.
