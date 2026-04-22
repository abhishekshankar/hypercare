/**
 * Tiny gate used by test-only routes (`/api/test/**`) and the answer-client
 * RAG override.
 *
 * Why not just `process.env.NODE_ENV === "test"`?  `next dev` forcibly sets
 * `NODE_ENV` to `"development"` for the spawned Node.js runtime regardless of
 * what the parent shell exports — so under Playwright's `webServer` (which
 * passes `NODE_ENV=test`), test-only routes still see `"development"` and
 * 404, and the RAG override seam silently no-ops.  We therefore *also* honor
 * `PLAYWRIGHT_TEST_BASE_URL`, which Playwright (or our `playwright.config.ts`)
 * exports for the dev server it owns.  Both gates are still combined with
 * `E2E_SETUP_SECRET` at the call site, so this does not weaken auth.
 *
 * Never returns true when `NODE_ENV === "production"` — mis-set
 * `PLAYWRIGHT_TEST_BASE_URL` in a deployed env must not open test-only routes
 * or the RAG mock seam (defense-in-depth; TASK-013).
 */
export function isE2ETestRuntime(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.NODE_ENV === "test") return true;
  const pw = process.env.PLAYWRIGHT_TEST_BASE_URL;
  return pw != null && pw.length > 0;
}
