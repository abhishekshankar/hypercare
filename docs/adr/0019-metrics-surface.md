# ADR 0019 — Internal metrics surface (no warehouse in v0)

## Status

Accepted · April 2026

## Context

PRD §12 requires **helpfulness**, **W2/W4/W8 return**, and **behavior change** to be reportable for sprint reviews and beta gates. The data lives in PostgreSQL; there is no product mandate for a data warehouse, BI tool, or third-party product analytics in the first beta (PRD scope explicitly avoids engagement-chasing DAU/streaks).

## Decision

- Ship a **read-only, admin-gated** operator UI at `/internal/metrics` that runs **parameterized SQL** (reviewable `.sql` files) against the app database at request time.
- Add a minimal **`user_sessions(user_id, visited_at, path)`** log (debounced to one row per user per 10 minutes) to define “active caregiver” and cohort denominators without building a full event pipeline. **No** IP, user-agent, or referrer.
- Add **`admin_audit(user_id, path, at)`** for compliance-style visibility of who opened internal tools.
- Extend **`messages`** with **ratings** (thumbs) and **operator telemetry** (retrieval tier, refusal code, token counts, generation latency) so SQL matches PRD language without a separate `answers_log` table in v0.
- Persist one-off **Bedrock order-of-magnitude cost** in `apps/web` config (not for billing); refresh when the production model/region or list price changes.
- Defer: Snowflake, PostHog, Amplitude, real-time streaming, CSV export, per-user PII “deep dive” from this surface.

## Why not a warehouse (yet)

- Cohort size is small; the PM needs **correct, inspectable** SQL more than 99.99% warehouse uptime.
- A second copy of PHI-adjacent rows raises governance work without moving the launch gate in the next quarter.
- The ADR is revisited when retention windows are long enough that hot-query cost or cross-product joins force it.

## Query location

Placed at `apps/web/src/lib/internal/metrics/sql/*.sql` (co-located with the loader) so the web app owns the contract; the files stay plain SQL for diffs and review without reading TS.

## Session log frequency

**One row per 10 minutes per user** (any `/app` path) — enough for denominators, light enough to avoid a chatty analytics table. Can be replaced by a real event bus later; queries key on `user_id` + time range only.

## Alternatives considered

- **dbt + warehouse:** correct for 100+ tables and cross-org BI; overkill and slower to ship.
- **Postgres materialized views refreshed nightly:** stale “as of standup” numbers and extra ops for refresh windows.
- **Inlined ORM only:** easier to ship but loses “PM copy-paste SQL” (acceptance) and drifts from reviewable text.

## Consequences

- Migrations add columns and two small tables; `docs/schema-v1.md` is updated.
- Admin access is **`users.role = 'admin'`** (see content-authoring workflow migration) with optional `INTERNAL_METRICS_ALLOW_EMAILS` for bootstrap before roles are set in DB.
- Unauthenticated or non-admin users receive **404** for `/internal/*` (no existence leak); HTTP **403** is available on `/api/internal/access` for API tests.
