# Contributing (deltas)

## E2E and `/api/test/*` endpoints

Playwright and CI may use **test-only** Route Handlers under `apps/web/src/app/api/test/**`. Conventions:

- **Gating:** `NODE_ENV === "test"` plus `E2E_SETUP_SECRET`; callers send `x-e2e-secret: <E2E_SETUP_SECRET>`. Routes return 404 or 401 if misconfigured or unauthorized.
- **Examples:** `GET /api/test/e2e-session` (session + onboarding reset for the onboarding spec), `POST` / `DELETE` `/api/test/conversation-mock` (install or clear a process-scoped `rag.answer()` override for the conversation E2E — see `answer-client.ts` and ADR 0010 §9).

Do not relax these checks for “local convenience”; extend the pattern or fix local env (see ADR 0010 known-issue footnote for Playwright + canonical redirect).
