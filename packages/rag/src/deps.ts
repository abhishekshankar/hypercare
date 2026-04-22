/**
 * Default dependency wiring for `answer()`. Pulls real implementations:
 *   - embed: Titan v2 via `@hypercare/content`
 *   - search: pgvector ANN via local `db/search.ts`
 *   - loadStage: care_profile lookup via `care/profile.ts`
 *   - generate: Bedrock Claude via `bedrock/claude.ts`
 *
 * Tests do NOT call this file. They build a `Deps` object explicitly and
 * call `runPipeline` directly.
 */

import { createDbClient } from "@hypercare/db";
import { embedTitanV2 } from "@hypercare/content";
import { defaultInvoke, makeDbPersist } from "@hypercare/safety";

import { invokeClaude } from "./bedrock/claude.js";
import { loadStageForUser } from "./care/profile.js";
import { searchChunks } from "./db/search.js";
import type { Deps } from "./pipeline.js";
import { classifyTopics } from "./topics/classifier.js";

export type BuildDepsOptions = {
  databaseUrl: string;
};

export function buildDefaultDeps(opts: BuildDepsOptions): Deps {
  // Single shared Drizzle client for safety persistence; createDbClient is
  // intentionally cheap (max=1 conn per call) and the safety package only
  // INSERTs on triage events (rare).
  const safetyDb = createDbClient(opts.databaseUrl);
  const safetyPersist = makeDbPersist({
    db: safetyDb,
    warn: (msg, ctx) => console.warn(msg, ctx ?? {}),
  });
  const warn = (msg: string, ctx?: Record<string, unknown>) => console.warn(msg, ctx ?? {});
  return {
    embed: (text) => embedTitanV2(text),
    search: ({ embedding, stage, k }) =>
      searchChunks({ databaseUrl: opts.databaseUrl, embedding, stage, k }),
    loadStage: (userId) => loadStageForUser(opts.databaseUrl, userId),
    generate: (input) => invokeClaude(input),
    warn,
    safety: {
      persist: safetyPersist,
      warn,
    },
    topicClassify: (input) => classifyTopics(input, { invoke: defaultInvoke, warn }),
  };
}
