/**
 * `@hypercare/rag` public surface.
 *
 * `answer(input)` is the single entry point used by routes / scripts. With
 * no `deps` argument, it builds the default wiring (Bedrock + Postgres) from
 * `DATABASE_URL`. Tests / evals can pass an explicit `deps` to swap in mocks
 * or alternate models.
 */

import { buildDefaultDeps } from "./deps.js";
import { runPipeline, type Deps } from "./pipeline.js";
import type { AnswerInput, AnswerResult } from "./types.js";

export async function answer(input: AnswerInput, deps?: Deps): Promise<AnswerResult> {
  const resolvedDeps =
    deps ??
    buildDefaultDeps({ databaseUrl: requireEnv("DATABASE_URL") });
  return runPipeline(input, resolvedDeps);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export type {
  AnswerInput,
  AnswerResult,
  Citation,
  RagUsage,
  RefusalReason,
  RetrievedChunk,
  SafetyTriageReason,
  Stage,
  TopicFields,
} from "./types.js";
export type { Deps } from "./pipeline.js";
export type { RecentTopicSignal } from "./topics/signal.js";
export { getRecentTopicSignal } from "./topics/signal.js";
export type { RagConfig } from "./config.js";
export { DEFAULT_CONFIG, withConfig } from "./config.js";
export { buildDefaultDeps } from "./deps.js";
export { runPipeline } from "./pipeline.js";
