/**
 * Default dependency wiring for `answer()`. Pulls real implementations:
 *   - embed: Titan v2 via `@alongside/content`
 *   - search: pgvector ANN via local `db/search.ts`
 *   - loadStage: care_profile lookup via `care/profile.ts`
 *   - generate: Bedrock Claude via `bedrock/claude.ts`
 *
 * Tests do NOT call this file. They build a `Deps` object explicitly and
 * call `runPipeline` directly.
 */

import { createDbClient } from "@alongside/db";
import { embedTitanV2 } from "@alongside/content";
import { defaultInvoke, makeDbPersist, makeFtShadowLogger } from "@alongside/safety";

import { ANSWER_MODEL_ID } from "./config.js";
import { invokeClaude, invokeClaudeStream } from "./bedrock/claude.js";
import { loadStageForUser } from "./care/profile.js";
import { searchChunks } from "./db/search.js";
import type { Deps } from "./pipeline.js";
import { classifyTopics } from "./topics/classifier.js";

export type BuildDepsOptions = {
  databaseUrl: string;
  /** Eval / manual jobs: force Layer-B routing without relying on process env. */
  safetyLayerBClassifier?: "zero_shot" | "fine_tuned";
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
  const logFtShadow = makeFtShadowLogger({ db: safetyDb, warn });
  const answerModelId = process.env.BEDROCK_ANSWER_MODEL_ID?.trim() || ANSWER_MODEL_ID;
  return {
    config: { answerModelId },
    embed: (text) => embedTitanV2(text),
    search: ({ embedding, stage, k }) =>
      searchChunks({ databaseUrl: opts.databaseUrl, embedding, stage, k }),
    loadStage: (userId) => loadStageForUser(opts.databaseUrl, userId),
    generate: (input) => invokeClaude(input),
    generateStream: (input, opts) => invokeClaudeStream(input, opts),
    warn,
    safety: {
      persist: safetyPersist,
      warn,
      logFtShadow,
      ...(opts.safetyLayerBClassifier !== undefined
        ? { layerBClassifierOverride: opts.safetyLayerBClassifier }
        : {}),
    },
    topicClassify: (input) => classifyTopics(input, { invoke: defaultInvoke, warn }),
  };
}
