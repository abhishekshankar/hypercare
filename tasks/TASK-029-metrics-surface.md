# TASK-029 — Internal metrics surface (PRD §12)

- **Owner:** Cursor
- **Depends on:** TASK-011 (conversations + messages with helpfulness thumbs), TASK-019 (lesson_progress + weekly_checkins), TASK-024 (the retention loop's writes)
- **Unblocks:** PM's launch-readiness review, the week-4 / week-8 retention checkpoints that the PRD §12 metrics call for
- **Status:** pending
- **ADR:** `docs/adr/0019-metrics-surface.md` (new — data model, query patterns, why-not-warehouse decision)

---

## Why this exists

PRD §12 names three success metrics in strict priority order: **helpfulness rate**, **return rate** (W2/W4/W8), **behavior change** (the weekly check-in). These already have data behind them after TASK-024 shipped the retention loop, but there is no surface to read them. Running one-off SQL in a tunnel does not count — PM needs a repeatable, click-through dashboard to gate sprint reviews and the beta launch on real numbers.

This ticket ships an **internal-only** metrics page. No warehouse, no BI tool, no eventing layer. Direct Postgres queries from the web app, admin-gated. Every tile links to the SQL that produced it — transparency doubles as "debug the metric when it looks wrong." A warehouse / posthog / amplitude integration is explicitly a post-beta conversation (see "Out of scope").

---

## Context to read first

1. `prd.md` §3.1 (goal targets — we render against these), §3.3 (north-star — the big number at the top), §12 (the exact three metrics + their operational definitions).
2. `packages/db/src/schema/messages.ts` — the thumbs column (added in TASK-011 or TASK-024 — find it).
3. `packages/db/src/schema/weekly-checkins.ts`, `lesson-progress.ts` (TASK-019).
4. `packages/db/src/schema/safety-flags.ts` + the TASK-025 updates (conversation_id, repeat_count).
5. `apps/web/src/lib/auth/role.ts` or the role helper added in TASK-028 / TASK-021 — same gate.

---

## What "done" looks like

### 1. Route: `/internal/metrics`

Admin role only. Layout:

- **Top row (north-star):** behavior-change rate — % of active caregivers whose most recent `weekly_checkins.tried_something = true`. Large number, 30-day window default, toggle to 7d / 14d / 30d / 90d / all.
- **Helpfulness row:** helpfulness rate (% of assistant messages with thumbs-up within 48h), denominator (number of assistant messages that received any rating), denominator-of-shown (assistant messages that surfaced the thumbs UI). Target line at 70% (PRD §3.1). Sparkline by week.
- **Return row:** W2, W4, W8 return rates against the latest cohort that's eligible (users created ≥ that many weeks ago). Target lines at 50 / 40 / 25% (PRD §12). Small cohort-size number beneath each.
- **Safety row:** flags by category (count, last 14 days), suppression-window active count, scripts nearing `next_review_due`. Links into `/internal/safety-flags` (a small table view — read the data, no actions).
- **Content row:** library size (published module count), last publish timestamp, refusals / week (thin-sources refusals from TASK-009), top 5 refusal query clusters (simple text-similarity group; shown as a hint for the content queue in TASK-028).
- **Retrieval row:** Tier-1 share (% of answered queries where top-ranked chunk was Tier-1), retrieval-zero count (answers that fell through to the refusal path), median latency.
- **Cost row:** rough token cost per day (sum of Bedrock token usage from TASK-017's threading, with published per-token prices hardcoded in a config file). Not for billing; for sanity.

Each tile carries:

- The number.
- The time window selector (shared across the page).
- A "↓ see SQL" expander that shows the exact query used. PM can copy-paste.
- A "↓ drill down" link where it makes sense (e.g. helpfulness → list of thumbs-down messages + their assistant responses).

### 2. Query patterns

Every metric is a **single parameterized SQL query** kept in `apps/web/src/app/internal/metrics/queries/*.sql` (not inlined into TS). This keeps the queries reviewable without reading JS. Loaded at build time; parameterized at request time.

Examples of what each query must return:

- `helpfulness_rate.sql` — `(rated_helpful, rated_total, shown_rating_ui_total)` over the window.
- `behavior_change_rate.sql` — `(tried_something_true, weekly_checkin_answered_total)` over the window, scoped to "active" caregivers (definition: opened `/app` at least once in the window).
- `wN_return.sql` — given a cohort start and N weeks, what fraction returned in week N? One query parameterized by N.
- `flag_counts_by_category.sql` — `(category, count, repeat_count_sum)` over the window.
- `refusals_by_cluster.sql` — group refusal `query_text` by trigram similarity; return top 5 clusters.
- `retrieval_tier1_share.sql` — over answered queries, fraction where `retrieval_log.top_rank.tier = 1`.

**Important:** most of these queries depend on existing columns. Where a column doesn't exist yet, the ticket adds it. Specifically:

- `messages.rated_at timestamptz` — timestamp of when a thumbs was clicked. (If TASK-011 didn't add this, add it here.)
- `messages.rating text check in ('up','down')` — the thumbs value. Same.
- An `answers_log` or extend `messages` with:
  - `retrieval_top_rank_tier int` (1 / 2 / 3 / null)
  - `refusal_reason text` (for refusal clustering)
  - `bedrock_usage_input_tokens int`, `bedrock_usage_output_tokens int` (TASK-017 threaded these but TODO check if they're persisted; if not, persist them here)

A small additive migration. Documented in `docs/schema-v1.md`.

### 3. Cohort definition

A **caregiver is "active" in a window** if they have any `messages` row or any `/app` visit event in that window. That implies a visit event. Add a lightweight `user_sessions(user_id, visited_at, path)` logger that fires once per `/app/*` page load (server-side component hook); debounced per-user to every 10 minutes to keep the table small. This is **not** analytics eventing — it's just the denominator for cohort metrics. Shape it so it can be replaced by a real eventing layer later without breaking the queries.

ADR 0019 is explicit that `user_sessions` is intentionally simple; it is **not** a surveillance surface. No IP, no UA, no referrer. Just `(user_id, visited_at, path)`.

### 4. Access + audit

- Admin-role gate (reuse TASK-028's role helper).
- Every page load writes an `admin_audit(user_id, path, at)` row so PM can see who looked at what. (Later: role separation so a metrics-only role exists.)
- No data export to CSV / clipboard in v0. If PM needs the data outside the UI, they run the SQL manually via tunnel. Keeps accidental exfil risk low.

### 5. Safety-flags drill-down (`/internal/safety-flags`)

A small read-only table view paginated by `created_at desc`:

- Columns: `category`, `severity`, `source` (rule | llm), `message_text` (first 200 chars), `user_id` (hashed / short), `repeat_count`, `created_at`.
- Filters: category, severity, date range.
- Link from each row into a safe conversation-context view at `/internal/conversation/[id]/memory` (TASK-027) and a "see full conversation" view (new — redacted, admin-only, reads `messages` for that conversation).

This is the surface the Caregiver-Support Clinician + Content Lead use for the PRD §10.2 weekly flagged-query audit.

### 6. Visual style

Plain, dense, boring. No charts library in v0 — inline SVG sparklines built with D3-less hand-written SVG (20 lines). PRD's emotional register does **not** apply here; this is an operator surface. But keep it readable — the CL + PM will live on this page.

---

## Tests

- Unit (`apps/web/test/internal/queries/*.test.ts`): each SQL file runs against a fixture DB, returns the shape the component expects.
- Unit (`apps/web/test/internal/cohort.test.ts`): `active caregivers in window` calculation correct for edge cases (user created mid-window, user with only lesson events, user with only check-in events).
- Integration (`apps/web/test/api/internal-metrics.test.ts`): the metrics page loads for an admin; returns 403 for a caregiver; rendered HTML contains the expected tiles with non-null numbers.
- Snapshot test for the page against a seeded DB fixture: numbers should be stable across runs.

---

## Acceptance criteria

- `/internal/metrics` renders the 7 rows above, with live numbers from the sprint-2 seeded data.
- Every tile shows its SQL on expand.
- Safety-flags drill-down works; admin-audit logs a row per visit.
- `user_sessions` table shipped; the cohort denominator reads from it.
- `messages` schema additions shipped (ratings, retrieval tier, refusal reason, token usage) if they weren't already.
- Targets (PRD §3.1, §12) are rendered as dashed target lines on the sparklines.
- No data leaves the admin surface (no CSV export in v0).
- ADR 0019 written (including "why not warehouse" reasoning).
- `pnpm lint typecheck test` green; eval doesn't regress.

---

## Out of scope

- Posthog / Amplitude / Segment. No third-party analytics SDK in v0. (Data stays inside the DB; the admin surface is enough for sprint-3 and beta.)
- Real-time dashboards. All numbers are as-of-request, not streaming.
- Anomaly detection / alerting. A CloudWatch alarm on flag-category-volume is a later ticket.
- Per-user deep dives ("drill down into user X's activity"). Privacy surface, not something we ship in v0.
- Revenue / subscription metrics — pricing is still an open question (PRD §14).
- Charts library. Hand-rolled SVG only.
- Public-facing stats pages.
- LTV / cohort curves with statistical confidence intervals.

---

## Decisions to make in the PR

- **Where queries live.** `apps/web/src/app/internal/metrics/queries/*.sql` vs `packages/db/src/queries/metrics/*.sql`. My vote: next to the page that renders them (`apps/web/.../queries/`) — keeps ownership obvious.
- **SQL loading.** Read at build time (embed as strings via a Vite/webpack loader or a simple build script) vs read at runtime (fs.readFile per request). My vote: build-time; caches in the bundle, no filesystem hit in prod.
- **Session-log write frequency.** Once per page load is too noisy; every 10 min per user is my vote. Record decision in ADR.
- **Hashing user IDs in the flags table view.** Show the raw UUID or a short stable hash? My vote: show the raw UUID — the admin who has access already has access.
- **Target lines on sparklines.** Draw them or just show the target number next to the current number? My vote: both.

---

## Questions for PM before starting

1. **Who gets admin role in prod.** PM + one eng. The seeding is manual via the TASK-028 CLI.
2. **How far back does the helpfulness rate look.** Default 30d is fine, or do you want 7d as default? My vote: 30d default, 7d easily switchable.
3. **What does "active caregiver" mean** for the north-star denominator? Today I've proposed "opened `/app` at least once in the window OR sent a message in the window." Sign off or adjust.
4. **Is the `admin_audit` table your only compliance logging for now,** or do you want structured CloudWatch events too? My vote: table + CloudWatch. Cheap.
5. **When a target isn't met** (e.g. helpfulness comes in at 58% — PRD §12 says < 60% is a content-quality problem, not growth), do we want an automated callout on the page? My vote: yes — a one-line interpretation per tile, conservative.

---

## How PM verifies

1. Log in as admin; visit `/internal/metrics`. Each of the 7 rows renders with a real number.
2. Switch the time window (7d / 30d / 90d). Numbers update; SQL expands to show the parameterized query.
3. Click through to `/internal/safety-flags` — see the sprint-1 + sprint-2 flags; filter by category; open a conversation drill-down.
4. Log in as a caregiver role; `/internal/metrics` → 403.
5. `psql -c "select path, count(*) from admin_audit where user_id = '<my-id>' and at > now() - interval '1 day' group by path;"` — shows your visits.
6. Manually run two of the queries via `psql` and compare against the tiles. Numbers match.
7. Read ADR 0019.
