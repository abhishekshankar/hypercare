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
  OperatorMetadata,
  RagUsage,
  RefusalReason,
  RetrievedChunk,
  RoutingAuditPayload,
  SafetyEscalationScript,
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
export { invokeClaude } from "./bedrock/claude.js";
export { runPipeline, runPipelineThroughCompose } from "./pipeline.js";
export type { PipelineComposeReady, PipelineThroughComposeResult } from "./pipeline.js";
export { runStreamingGeneration } from "./streaming/generation-stream.js";
export type { StreamGenerationOptions } from "./streaming/generation-stream.js";
export { fastPathVerifyChunk } from "./streaming/fast-path-verifier.js";
export { findNextCommitEnd } from "./streaming/commit-buffer.js";
export { invokeClaudeStream } from "./bedrock/claude.js";
export type { StreamChunk } from "./bedrock/claude.js";
export { loadConversationMemoryForAnswer } from "./memory/load.js";
export {
  runConversationMemoryRefresh,
  countUserMessagesInConversation,
  shouldRunMemoryRefresh,
} from "./memory/refresh.js";
export { parseMemorySections } from "./memory/section-parse.js";
export { augmentMemoryUserMessageWithForgotten, forgottenVerifierRetryPrefix } from "./memory/prompt-forgotten.js";
export { verifyMemorySummaryBannedContent } from "./memory/verify-banned.js";
export { verifyMemorySummaryForgottenContent } from "./memory/verify-forgotten.js";
export { estimateTokenCount } from "./memory/tokens.js";
export { rewriteQueryWithMemory } from "./memory/query-rewrite.js";
export type { ConversationMemoryForPrompt, MemoryRefreshLog } from "./memory/types.js";
