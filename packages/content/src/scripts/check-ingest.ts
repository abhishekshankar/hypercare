/**
 * Offline smoke: shared parse → front matter → chunk path (no DB, no Bedrock).
 * `pnpm --filter @alongside/content check:ingest`
 */
import { TOPICS_V0 } from "@alongside/db";
import { chunkModuleBody } from "../chunk.js";
import { moduleFrontMatterSchema } from "../schema.js";

const t0 = TOPICS_V0[0]!.slug;
const t1 = TOPICS_V0[1]!.slug;
const front = moduleFrontMatterSchema.parse({
  slug: "smoke-ingest-check",
  title: "Smoke",
  category: "behaviors",
  tier: 2,
  stage_relevance: ["early", "late"],
  summary: "s",
  attribution_line: "a",
  expert_reviewer: null,
  review_date: null,
  topics: [t0, t1],
});
const chunks = chunkModuleBody("## A\nx\n## B\ny\n");
if (chunks.length < 1) {
  throw new Error("expected at least one chunk");
}
void front;
console.log("check:ingest ok");
