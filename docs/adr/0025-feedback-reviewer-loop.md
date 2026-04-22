# ADR 0025 — In-app feedback + thumbs-down reviewer loop (TASK-036)

## Status

Accepted (2026-04-22)

## Context

The beta commits to reading qualitative signal (PRD §12). We need (1) a non-email contact path for caregivers, (2) a single triage queue that includes thumbs-downs, and (3) lightweight SLA visibility without over-building automation.

## Decisions

### Thumbs-down → queue: app-layer hook (not DB trigger)

The only writer for `messages.rating` is `POST /api/app/messages/[messageId]/rating`. On `rating = 'down'`, the handler inserts into `user_feedback` with `kind = 'thumbs_down'`, `include_context = true`, and idempotency via partial unique index on `message_id` where `kind = 'thumbs_down'`.

### Escalation / high priority

There is no `messages.safety_flag_id` column. We treat **safety escalation assistant turns** as those with `messages.refusal_reason_code = 'safety_triaged'`. Those thumbs-down rows get `triage_priority = 'high'`.

### `triage_priority` column

Separate from `triage_state`: values `normal` | `high`. Default `normal`.

### Notifications

- **Slack:** optional `SLACK_FEEDBACK_WEBHOOK_URL` (e.g. `#hc-feedback-queue`). Used for high-priority thumbs-down, stale-queue SLA, module-link notices (link-only to `/internal/feedback`, not full body in chat).
- **Module owner:** no separate email in v1; linking a module posts the same webhook with title + link.

### SLA automation

EventBridge (or any scheduler) should `POST /api/cron/feedback-sla` with `Authorization: Bearer ${CRON_SECRET}` nightly.

Thresholds (beta):

- \>10 items in `triage_state = 'new'` older than **72h** → Slack message.
- Any `triage_priority = 'high'` still `new` older than **24h** → urgent Slack message.

### Out of scope (v1)

Replying to users from the queue, LLM triage, user-visible resolution state.

## Consequences

- Operators use `/internal/feedback` with the same admin gate as `/internal/metrics`.
- Triage transitions are recorded in `admin_audit` with JSON `meta`.
