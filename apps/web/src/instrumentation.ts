/**
 * Eagerly validate server environment on production Node.js startup (fail loud, PROJECT_BRIEF §5).
 * `next dev` skips this so engineers can start the app before `apps/web/.env.local` exists; routes
 * still import `env.server` and will error on the first request that needs secrets.
 * Does not run on the Edge runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  if (process.env.NODE_ENV === "development") {
    return;
  }
  await import("./lib/env.server");
}
