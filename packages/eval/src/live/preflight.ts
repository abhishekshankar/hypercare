/**
 * Live-eval preflight: fail fast with an actionable message instead of
 * letting the runner produce "0% recall" against an empty DB.
 *
 * If `modules` is empty (TASK-008 loader hasn't run against this DB), we
 * point the operator at the loader rather than at the rag pipeline. See
 * `tasks/TASK-012-eval-harness.md` (preflight section).
 */

import { createDbClient, modules } from "@hypercare/db";

export async function assertModulesPresent(databaseUrl: string): Promise<void> {
  const db = createDbClient(databaseUrl);
  const all = await db.select({ published: modules.published }).from(modules);
  const n = all.length;
  const published = all.filter((r) => r.published === true).length;
  if (n === 0) {
    throw new Error(
      [
        "Preflight failed: `modules` table is empty.",
        "Run the TASK-008 content loader against this DB before EVAL_LIVE=1:",
        "  DATABASE_URL_ADMIN=$DATABASE_URL CONTENT_MODULES_DIR=$(pwd)/content/modules \\",
        "    pnpm --filter @hypercare/content load",
        "(See `tasks/TASK-012-eval-harness.md` § Preflight.)",
      ].join("\n"),
    );
  }
  if (published === 0) {
    throw new Error(
      `Preflight failed: ${String(n)} modules exist but none are published=true. Re-run the loader.`,
    );
  }
}
