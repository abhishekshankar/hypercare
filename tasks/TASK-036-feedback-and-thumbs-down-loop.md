# TASK-036 — In-app feedback + thumbs-down reviewer loop

- **Owner:** Cursor (surfaces, queue, SLA job); PM + Care Specialist (review the queue, triage); content team (acts on feedback that points to module issues)
- **Depends on:** TASK-011 (assistant-turn rating thumbs up/down column on `messages`), TASK-021 (the in-app help surface or whatever the support entrypoint is — if not yet shipped, this ticket ships that too), TASK-029 (`/internal/*` admin auth + metrics surface — we add to it)
- **Unblocks:** the closed-beta → GA learning loop; PRD §12 "we actually read the thumbs-downs" commitment; a defensible answer to *"what did you do with the signal?"*
- **Status:** done (code + ADR; apply migration `0012` in each env; wire `SLACK_FEEDBACK_WEBHOOK_URL` + `CRON_SECRET` + EventBridge)
- **ADR:** `docs/adr/0025-feedback-reviewer-loop.md` (new — queue semantics, SLA, what closes a ticket, who reviews)

---

## Why this exists

The beta cohort is small enough that we can read every thumbs-down and act on it. Two gaps today:

1. **No support entrypoint.** A caregiver who's hit a wall has no "tell us" path besides rating a turn down. Email would work but we don't publish one. They need an in-app surface.
2. **Thumbs-down is captured, not triaged.** TASK-011 writes a row to `messages.rating`; nothing happens after that. For 150-ish beta users over 6 weeks we expect dozens of thumbs-downs per week. Reading them is a job; batching them into a reviewer queue is the ergonomic thing.

The PRD §12 north-star rests on believing we're learning from the product. This is the ticket that makes "we're learning" concrete.

---

## Context to read first

1. `prd.md` §12 (success metrics, including the qualitative feedback commitment), §3.1 (helpfulness ≥70% target — thumbs-downs are the leading indicator when it slips).
2. TASK-011's ticket and the resulting schema on `messages` — we extend it here, we don't rebuild it.
3. TASK-029's `/internal/metrics` — we add a feedback queue alongside it at `/internal/feedback` sharing the same admin gate.
4. `apps/web/src/app/(authed)/app/` — wherever TASK-021 planted the help surface. If not yet shipped, shape the minimum here.
5. `packages/safety/src/scripts/` — if a thumbs-down came on an escalation turn, we route it differently. See §3 below.

---

## What "done" looks like

### 1. `/help → contact support` surface

A nav entry (kebab menu on mobile, sidebar on desktop) labeled "Help & feedback" linking to `/app/help`. The page:

- A short "What's going on?" dropdown: *"Something felt off in a reply" / "I couldn't find what I needed" / "I want to suggest something" / "Other"*.
- A free-text box (up to 2000 chars).
- A checkbox: *"Include the last conversation with my message so the team can see the context"* — defaults unchecked.
- Submit → writes to new `user_feedback` table (§2), returns to `/app` with a toast *"Thanks — we read every one of these."* No email sent.
- Under the form, a small note: *"If you're in a crisis or worried about your person's immediate safety, this form isn't the fastest way — we show crisis resources in any conversation, or you can reach them directly: 988 (US) / 911 for emergencies."* — review with Care Specialist before merge; do not invent resources.

This is the first time a caregiver has a non-rating channel. Intentionally minimal so the reviewer burden matches the beta cohort size.

### 2. Schema

New table `user_feedback`:

```
CREATE TABLE user_feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  kind            text not null check (kind in ('off_reply','not_found','suggestion','other','thumbs_down')),
  body            text,                                  -- NULL for pure thumbs_down with no text
  conversation_id uuid references conversations(id) on delete set null,
  message_id      uuid references messages(id) on delete set null,
  include_context boolean not null default false,
  submitted_at    timestamptz not null default now(),
  triage_state    text not null default 'new'
                    check (triage_state in ('new','reading','needs_content_fix','needs_classifier_fix',
                                            'needs_product_fix','ack_and_close','spam_or_invalid')),
  triaged_by      uuid references users(id),
  triaged_at      timestamptz,
  resolution_note text,
  linked_module_id uuid references modules(id),          -- set when triage points to a module issue
  linked_task_id   text                                   -- "TASK-NNN" when triage spawns follow-up work
);

CREATE INDEX user_feedback_triage_idx ON user_feedback(triage_state, submitted_at);
```

Thumbs-downs flow into the same table via a trigger (§3), so `/internal/feedback` has one queue, not two.

Migration under `packages/db/migrations/`; schema doc update in `docs/schema-v1.md`.

### 3. Thumbs-down → queue trigger

TASK-011 writes `messages.rating = 'down'` with `rated_at`. On that write, `packages/db/src/triggers/feedback-from-rating.ts` (or a small application-layer hook — decide in ADR; my vote: app-layer hook in the rating endpoint, it's one extra insert) inserts a matching `user_feedback` row:

```
kind = 'thumbs_down'
body = NULL (the rater has no text)
conversation_id, message_id = the message rated
include_context = true (we always want to see the message for a thumbs-down)
triage_state = 'new'
```

If the message rated was an **escalation-script turn** (check `messages.safety_flag_id is not null`), the feedback row is tagged `kind='thumbs_down'` but also flagged `triage_priority='high'` (new column on `user_feedback`; decide whether separate column or encode in `triage_state` — I'd add the column, it's cheap). A thumbs-down on a crisis script is the single highest-signal event we can get and should jump the queue.

### 4. `/internal/feedback` — the reviewer surface

Admin-gated (same gate as `/internal/metrics`). Three-column layout:

- Left: filters — triage state, kind, date range, "high priority only" toggle, free-text search on body.
- Middle: queue list, newest first, 25 per page. Each row: timestamp, user (anonymized handle, not email), kind, first 120 chars of body (or "(no body — thumbs-down)"), triage state badge.
- Right: when a row is selected — full body, the linked message + conversation context (if `include_context` or if it's a thumbs-down), assistant's response in full, citations, safety flags if any, the user's stage + weekly focus at time of feedback.

Reviewer actions from the right pane:

- **Set triage state** — dropdown; transitions land in `user_feedback` + an audit row in `admin_audit` (TASK-029).
- **Write resolution note** — free text, saved on submit.
- **Link to module** — picker of modules (searchable); sets `linked_module_id`. Triggers a notification to the module's owner (email or Slack — see decisions).
- **Link to TASK** — free text, format `TASK-NNN`; validated regex.
- **Reply to user** — *out of scope for v1*. Big commitment. See §out-of-scope.

### 5. SLA monitor

EventBridge → Lambda nightly:

- Count `user_feedback` rows with `triage_state = 'new'` and `submitted_at < now() - interval '72 hours'`. Log to `/internal/metrics` (new tile).
- If the count > 10, post to `#hc-feedback-queue` Slack channel. *"N feedback items over 72h."* Same pattern as TASK-035 drift.
- If **any** high-priority row (`triage_priority='high'`) is older than 24h in state `new`, page PM + Care Specialist (Slack at-mention; PagerDuty optional — see decisions).

Thresholds live in `docs/adr/0025-feedback-reviewer-loop.md`. The numbers are a guess for the beta cohort size; sprint-5 revisits with actual volume.

### 6. Metrics integration

`/internal/metrics` gets a row: **Feedback loop health**. Columns:

- New items this week.
- % closed within 72h.
- % of thumbs-downs that resolved to `needs_content_fix` (a leading signal that the library has gaps).
- Median time to triage.

Source: SQL query files under `apps/web/src/app/internal/metrics/queries/feedback-*.sql` per TASK-029's pattern.

### 7. Observability

Every triage state transition writes to `admin_audit`. Every content-team ping (module link → owner notify) writes to `admin_audit`. No PII in logs beyond user_id; feedback body is in the DB, not the log.

---

## API

```
POST  /api/app/feedback                 body: { kind, body, include_context, message_id? }  → { id }
GET   /api/internal/feedback            query: { state?, kind?, q?, priority?, cursor? }     → { items, next_cursor }
GET   /api/internal/feedback/:id        full feedback + conversation context
POST  /api/internal/feedback/:id/triage body: { state, resolution_note?, linked_module_id?, linked_task_id? }
```

All `/api/internal/*` admin-gated.

---

## Tests

- Unit (`apps/web/test/api/feedback-submit.test.ts`): submit fields land in the row; `include_context=true` with a `message_id` hydrates conversation reference.
- Unit (`apps/web/test/feedback/rating-trigger.test.ts`): thumbs-down on a message → feedback row with `kind='thumbs_down'` + `triage_priority='high'` if the message had a safety flag.
- Integration (`apps/web/test/internal/feedback-queue.test.ts`): admin can list, filter, triage; non-admin gets 403.
- Integration (`apps/web/test/internal/feedback-sla.test.ts`): SLA Lambda against seeded fixture reports the expected overdue count; high-priority escalation alert fires.
- E2E (`apps/web/test/e2e/feedback-flow.spec.ts`):
  1. User submits a "not_found" with body.
  2. Admin sees it in `/internal/feedback`.
  3. Admin triages to `needs_content_fix`, links a module, writes resolution note.
  4. Module owner receives the notification (mock Slack in test env).
  5. `/internal/metrics` feedback row updates within the test window.

---

## Acceptance criteria

- `/app/help` surface ships with the four-kind dropdown and crisis-resources footer (Care Specialist-signed).
- `user_feedback` table + indexes shipped; migration reviewed.
- Thumbs-down → queue trigger in place; escalation-turn thumbs-downs get `triage_priority='high'`.
- `/internal/feedback` queue with the described filters, right-pane detail, and triage actions.
- SLA Lambda deployed; Slack channel wired; `/internal/metrics` feedback row renders.
- `pnpm lint typecheck test` green; eval doesn't regress; red-team gate unchanged.
- ADR 0025 written.

---

## Out of scope

- **Replying to the user from the queue.** Big commitment (consent, tone, legal review of outbound copy, impersonation concerns). If we want this, it's its own sprint-5 ticket. Today, users submit into silence — the in-app toast *"we read every one"* is the only acknowledgment. We should document that choice, not paper over it.
- **NPS-style surveys.** The thumbs rating + this free-text form is enough signal for beta.
- **Categorization by LLM.** Triage is human for the beta cohort. Revisit when volume justifies it — sprint 6+ at the earliest.
- **User-facing resolution visibility.** The user doesn't see that their feedback was triaged to `needs_content_fix`. A "thanks, here's what we changed" email is a v2 nicety.
- **Aggregating thumbs-down rationales via LLM for a weekly digest.** Sprint 5.
- **Forwarding feedback to external issue trackers (Linear, Jira).** We don't use one. The `linked_task_id` field is a string — we reference `TASK-NNN` in our own TASKS.md.

---

## Decisions to make in the PR

- **Thumbs-down trigger implementation: DB trigger vs app-layer hook.** My vote: app-layer hook in the rating endpoint. One less surface to maintain; the rating endpoint is already the single writer for `messages.rating`.
- **Module-owner notification: Slack vs email.** My vote: Slack DM via bot; email is higher overhead and we have a Slack workspace already.
- **`triage_priority` as a separate column vs encoded in `triage_state`.** My vote: separate column; clean semantics, simple index.
- **High-priority SLA: 24h paging threshold.** Sign off on 24h, or tighter (12h) or looser (48h)? My vote: 24h for beta; tighten after launch if we see misses.
- **Can a non-admin see their own feedback history on the profile page?** Not in v1 — no need for the beta cohort, and it's another user-visible surface to legal-review. Sprint 5 candidate.

---

## Questions for PM before starting

1. **Who reviews the queue?** My assumption: PM + Care Specialist split duty, Mon/Wed/Fri sweeps. Please confirm the rota so the SLA numbers are honest.
2. **The "thanks — we read every one" promise.** If we miss some during launch week, we've lied in the toast. Are you comfortable with that copy as-is, or soften to *"thanks — we'll read this within a few days"*? My vote: ship the stronger promise and live up to it.
3. **High-priority paging channel.** Slack at-mention is cheap; PagerDuty is weight. My vote: Slack-only for beta; revisit after a real incident.
4. **Notification content when a thumbs-down links to a module.** Do we send the full feedback body to the module owner, or a link to `/internal/feedback/:id`? My vote: link-only; keeps the notification low-context, owner clicks through to the full record.

---

## How PM verifies

1. From a caregiver session, open the kebab menu → Help & feedback. Submit a *not_found* with body.
2. From an admin session, open `/internal/feedback` → the row is there, state `new`, high-priority flag off.
3. In a separate session, thumbs-down a regular assistant turn. New feedback row in the queue, kind `thumbs_down`.
4. Thumbs-down an escalation-script turn. New feedback row with high priority; Slack notification fires to `#hc-feedback-queue` (tested in staging).
5. Triage a row to `needs_content_fix`, link a module. Module owner gets a Slack DM within seconds.
6. Wait 72h (or time-shift in staging). SLA Lambda posts the overdue count to `#hc-feedback-queue`; `/internal/metrics` feedback row reflects it.
7. Read ADR 0025.
