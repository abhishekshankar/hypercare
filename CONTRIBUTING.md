# Contributing (deltas)

## E2E and `/api/test/*` endpoints

Playwright and CI may use **test-only** Route Handlers under `apps/web/src/app/api/test/**`. Conventions:

- **Gating:** Use `isE2ETestRuntime()` from `apps/web/src/lib/env.test-runtime.ts` (not raw `NODE_ENV` checks). Under Playwright, `next dev` forces `NODE_ENV="development"` in the server process, so the helper also treats `PLAYWRIGHT_TEST_BASE_URL` as an E2E signal. The helper is always `false` when `NODE_ENV === "production"`. Combine with `E2E_SETUP_SECRET`; callers send `x-e2e-secret: <E2E_SETUP_SECRET>`. Routes return 404 or 401 if misconfigured or unauthorized.
- **Examples:** `GET /api/test/e2e-session` (session + onboarding reset for the onboarding spec), `POST` / `DELETE` `/api/test/conversation-mock` (install or clear a process-scoped `rag.answer()` override for the conversation E2E — see `answer-client.ts` and ADR 0010 §9).

Do not relax these checks for “local convenience”; extend the pattern or fix local env (see ADR 0010 known-issue footnote for Playwright + canonical redirect).

## Database integration tests (`@hypercare/db`)

Some tests hit real Postgres and are **skipped** unless you opt in:

| Env | Effect |
| --- | --- |
| `CITATIONS_DENORM_INTEGRATION=1` plus `DATABASE_URL` | Runs `packages/db/test/citations-denorm.integration.test.ts` (citations jsonb immutability when `module_chunks` changes). |
| `ROUTING_INTEGRATION=1` plus `DATABASE_URL` | Runs `packages/db/test/model-routing-decisions.integration.test.ts` (insert + 90d-style prune for `model_routing_decisions`). |

Example (tunnel or local URL):

`CITATIONS_DENORM_INTEGRATION=1 DATABASE_URL=postgres://... pnpm --filter @hypercare/db test test/citations-denorm.integration.test.ts`

`ROUTING_INTEGRATION=1 DATABASE_URL=postgres://... pnpm --filter @hypercare/db test test/model-routing-decisions.integration.test.ts`

## Schema deltas (TASK-043)

- New tables and columns land in [`docs/schema-v2.md`](docs/schema-v2.md) — the Sprint 5 schema-of-record. v0 (`docs/schema-v0.md`) and v1 (`docs/schema-v1.md`) remain accurate snapshots; v2 extends additively and does not modify them.
- Fork into `docs/schema-v3.md` if v2 grows past ~600 lines (same convention as v1→v2 per `TASKS.md` Sprint 4 quality gates).
- For every `pgTable("…")` you add in `packages/db/src/schema/`, add a section in `docs/schema-v2.md` (or, exceptionally, the active vN doc). The [`packages/db/test/schema-doc-coverage.test.ts`](packages/db/test/schema-doc-coverage.test.ts) check fails the build if a Drizzle table is missing from the schema docs.

## Model routing (TASK-042)

- **Migrate first:** apply `packages/db/migrations/0021_model_routing.sql` (adds `users.routing_cohort` and `model_routing_decisions`).
- **Flag:** `MODEL_ROUTING=1` in `apps/web` server env (also documented in `.env.example` and `PROJECT_BRIEF.md`).
- **Policy:** edit `packages/model-router/config/model-routing.yaml` only with Care Specialist sign-off per ADR 0030.
- **Operator metrics:** `/internal/metrics` includes a **Model routing A/B** section (SQL `routing_ab_comparison`) when the table exists; the loader skips the tile if the query fails (e.g. DB not migrated yet).

## Route-handler tests without Postgres

Some Vitest suites call Route Handlers that open Drizzle (`createDbClient`) while still using a dummy `DATABASE_URL`. Prefer **mocking `@hypercare/db`’s `createDbClient`** (stub `select` / `limit` chains) instead of requiring a live `hc_test` database. For `@/lib/env.server`, prefer **`vi.mock` with `importOriginal`** and override only `serverEnv` fields so helpers like `streamingAnswersEnabled()` and `modelRoutingEnabled()` stay aligned with production code (`test/safety/conversation-escalation.test.ts`).
