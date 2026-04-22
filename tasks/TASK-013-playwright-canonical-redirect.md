# TASK-013 — Disable canonical-origin redirect under Playwright dev server

- **Status:** done
- **Blocks:** None (papercut; TASK-011 acceptance is met via the same E2E base-URL pattern as `onboarding.spec.ts`)
- **Related:** ADR 0010 — footnote in “Known issues (local dev)”

---

## Problem

When running Playwright against `next dev`, the middleware that enforces canonical origin can redirect in a way that **loops** if the test base URL and the app’s expected canonical host diverge. This is a pre-existing developer friction, not a TASK-011 defect.

## Preferred fix

- When **`PLAYWRIGHT_TEST_BASE_URL` is set** (Playwright already sets this for the webServer URL), **no-op** the canonical-redirect branch in middleware so local E2E does not fight the dev server.
- **Do not** add `NEXT_PUBLIC_DISABLE_CANONICAL_REDIRECT` (or similar): a public env flag is too easy to mis-set in production.

## Acceptance

- With `PLAYWRIGHT_TEST_BASE_URL` set, `pnpm` Playwright (conversation + onboarding) runs without redirect loops against `next dev` on the same machine.
- Without that env var, production/staging behavior is unchanged.
- Playwright no-op is belt-and-suspenders: it does not apply when `NODE_ENV === "production"` (the whole loopback redirect is dev-only, but the Playwright branch is explicitly production-safe).
- ADR 0010 known-issue updated to reflect the fix.

## Verification (done)

- `canonical-origin.test.ts` covers Playwright no-op and production + `PLAYWRIGHT_TEST_BASE_URL` (no effect in prod).
- `isE2ETestRuntime()` returns `false` in production even if `PLAYWRIGHT_TEST_BASE_URL` is set (`test/lib/env.test-runtime.test.ts`).
- No `NEXT_PUBLIC_*` disable flag.
