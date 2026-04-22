import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const e2eEnv = JSON.parse(
  fs.readFileSync(path.join(root, "test/e2e/e2e-server-env.json"), "utf8"),
) as Record<string, string>;

const baseURL = e2eEnv.AUTH_BASE_URL;
if (baseURL == null || baseURL.length === 0) {
  throw new Error("e2e-server-env.json: missing AUTH_BASE_URL");
}

export default defineConfig({
  testDir: "test/e2e",
  // Multiple specs (conversation, onboarding) share the same Playwright
  // test user (`e2e-onboarding-playwright`) and the seed routes destructively
  // reset its rows in `beforeEach`. Parallel workers race on
  // `care_profile_user_id_unique`. Keep one worker for the whole suite.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm exec next dev --turbopack -p 3456 -H 127.0.0.1 .",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // e2e-server-env must win over a parent shell that exports empty Cognito/DB placeholders,
    // EXCEPT for DATABASE_URL: developers running locally with a real Postgres tunnel up should
    // be able to point the dev server at it without editing e2e-server-env.json.
    env: {
      ...process.env,
      ...e2eEnv,
      ...(process.env.DATABASE_URL != null && process.env.DATABASE_URL.length > 0
        ? { DATABASE_URL: process.env.DATABASE_URL }
        : {}),
      ...(process.env.E2E_STREAMING_LIBRARY === "1"
        ? { STREAMING_LIBRARY: "1", NEXT_PUBLIC_STREAMING_LIBRARY: "1" }
        : {}),
      NODE_ENV: "test",
      // TASK-013: signal the canonical-origin middleware to skip the loopback
      // bounce (next dev forces NODE_ENV="development" in Edge middleware
      // regardless of the parent process env, so the dev-only branch fires).
      PLAYWRIGHT_TEST_BASE_URL: baseURL,
    },
    cwd: root,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
