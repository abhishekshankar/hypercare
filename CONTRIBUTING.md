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

Example (tunnel or local URL):

`CITATIONS_DENORM_INTEGRATION=1 DATABASE_URL=postgres://... pnpm --filter @hypercare/db test test/citations-denorm.integration.test.ts`
