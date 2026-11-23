/**
 * Live Layer B smoke: real Bedrock + Postgres. Uses the default classifier model
 * from `packages/safety/src/config.ts` (Haiku 4.5 `us.*` profile).
 *
 *   DATABASE_URL=postgres://... \
 *   AWS_REGION=ca-central-1 \
 *   pnpm --filter @alongside/safety smoke-llm -- --user-id <uuid>
 *
 * Confirms: `classify()` triages a Layer-A miss with source `llm`, and the
 * latest `safety_flags` row for that user has `source = 'llm'`.
 */
import { desc, eq } from "drizzle-orm";

import { createDbClient, safetyFlags } from "@alongside/db";
import { buildDefaultDeps, classify } from "../src/index.js";
import { CLASSIFIER_MODEL_ID } from "../src/config.js";

const SUBTLE =
  "Things have been really hard and I don't see the point some days";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

async function main() {
  if (!process.env.SAFETY_LIVE) {
    console.error("Set SAFETY_LIVE=1 to run this script (confirms you intend live Bedrock + DB).");
    process.exit(2);
  }
  const userId = arg("user-id") ?? process.env.SMOKE_USER_ID;
  if (!userId) {
    console.error("smoke-llm: pass --user-id <uuid> or set SMOKE_USER_ID");
    process.exit(2);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.trim()) {
    console.error("smoke-llm: DATABASE_URL is required");
    process.exit(2);
  }
  if (process.env.BEDROCK_CLASSIFIER_MODEL_ID) {
    console.log("Using BEDROCK_CLASSIFIER_MODEL_ID:", process.env.BEDROCK_CLASSIFIER_MODEL_ID);
  } else {
    console.log("Using default CLASSIFIER_MODEL_ID:", CLASSIFIER_MODEL_ID);
  }
  const db = createDbClient(databaseUrl);
  const deps = buildDefaultDeps({
    db,
    warn: (msg, ctx) => console.error(`[warn] ${msg}`, ctx ?? ""),
  });
  const r = await classify({ userId, text: SUBTLE }, deps);
  console.log("classify result:", r);
  if (!r.triaged) {
    console.error("Expected triaged: true (Layer B should catch this phrasing).");
    process.exit(1);
  }
  if (r.source !== "llm") {
    console.error("Expected source llm, got:", r.source);
    process.exit(1);
  }
  const [row] = await db
    .select()
    .from(safetyFlags)
    .where(eq(safetyFlags.userId, userId))
    .orderBy(desc(safetyFlags.createdAt))
    .limit(1);
  if (!row) {
    console.error("No safety_flags row for user (persist may have failed — check warn logs).");
    process.exit(1);
  }
  if (row.source !== "llm") {
    console.error("DB row source expected llm, got:", row.source);
    process.exit(1);
  }
  console.log("OK — Layer B + DB row source=llm. Latest row id:", row.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
