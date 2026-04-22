import { test } from "@playwright/test";

/**
 * Full flows (export zip, delete + DB assertions) need the dev DB tunnel + S3 bucket
 * and are covered in PM verification (TASK-032). Re-enable when a stable e2e env exists.
 */
test.skip("profile privacy: download + delete (requires tunnel + S3)", async () => {
  // TODO: log in, /app/profile, download, delete
});
