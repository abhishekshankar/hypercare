# Beta cohort metrics — Sprint 4 snapshot

**Purpose:** Ground Sprint 6 scope decisions in the same numbers the operator dashboard uses (PRD §12, TASK-029). The live UI is `/internal/metrics` (admin-gated); this file is the **dated paper trail** when you need a stable reference in Git.

**How to refresh:** After DB tunnel or on a host with `DATABASE_URL`, open **`/internal/metrics`** as an admin. Copy the three headline figures below on the same calendar day (or paste from a standup screenshot). Update the **Snapshot as-of** row and commit.

**Definitions** (must match the shipped SQL or the snapshot is not comparable):

| Metric | Definition | Query file |
|--------|------------|--------------|
| **Helpfulness %** | Among assistant `messages` in the selected **time window**, thumbs-up ÷ any rating, only when `rated_at` is within **48h** of `created_at`. | [`helpfulness_rate.sql`](../apps/web/src/lib/internal/metrics/sql/helpfulness_rate.sql) |
| **Check-in yes-rate** (“behavior change”) | Among `weekly_checkins` with `answered_at` in the window, % with `tried_something = true`, restricted to users **active** in that window (session visit or any message in window). | [`behavior_change_rate.sql`](../apps/web/src/lib/internal/metrics/sql/behavior_change_rate.sql) |
| **W2 / W4 / W8 return** | Users whose `created_at` is at least **n×7 days** ago; “returned” in week n if they had a debounced **`user_sessions`** row or any **`messages`** timestamp in `[created + (n−1)·7d, created + n·7d)`. **Not** filtered by invite list or “closed beta” dates — it is the **global** eligible cohort on the DB. | [`return_cohort.sql`](../apps/web/src/lib/internal/metrics/sql/return_cohort.sql) |

**Window picker:** Helpfulness and check-in rows respect `?w=7d|14d|30d|90d|all` (default **30d**). Return tiles **do not** change with the window — only the headline pair above do.

**“Sprint 4 cohort” nuance:** Product language often means *caregivers who were in the closed beta*. The dashboard’s W4/W8 denominators are **all** accounts old enough to complete those weeks. If you need a **date-bounded beta slice**, run a one-off variant of `return_cohort.sql` / helpfulness SQL adding `AND u.created_at >= $beta_start AND u.created_at < $beta_end` on `users u` (and equivalent joins for messages); record that variant in the notes row below when you use it.

---

## Snapshot table (fill from `/internal/metrics`)

| Field | Value |
|-------|-------|
| **Snapshot as-of (UTC)** | _YYYY-MM-DD — fill when capturing_ |
| **Environment** | _e.g. production `hypercare_dev` / staging — fill_ |
| **Helpfulness %** | _—_ |
| **Rated denominator** (rated_total) | _—_ |
| **Rating UI shown** (shown_rating_ui_total) | _—_ |
| **Helpfulness window** | _e.g. Last 30d (`?w=30d`) or All time (`?w=all`)_ |
| **Check-in yes-rate %** | _—_ |
| **Check-ins counted** (weekly_checkin_answered_total) | _—_ |
| **Check-in / behavior window** | _match helpfulness window above_ |
| **W2 return %** | _—_ |
| **W2 cohort size (n)** | _—_ |
| **W4 return %** | _—_ |
| **W4 cohort size (n)** | _—_ |
| **W8 return %** | _—_ |
| **W8 cohort size (n)** | _—_ |
| **PRD targets (for comparison)** | Helpfulness ≥ **70%**; W2 ≥ **50%**, W4 ≥ **40%**, W8 ≥ **25%**; check-in yes ≥ **50%** — see `prd.md` §3.1 / §12 |
| **Notes** | _Optional: beta date filter, routing A/B slice, anomalies, data quality caveats_ |

---

## Related docs

- ADR: [`docs/adr/0019-metrics-surface.md`](adr/0019-metrics-surface.md)  
- Ticket: [`tasks/TASK-029-metrics-surface.md`](../tasks/TASK-029-metrics-surface.md)  
- PRD metrics section: `prd.md` §12
