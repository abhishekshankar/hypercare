/**
 * Pipeline orchestrator — wires the 7 named layers (0..6) into one call.
 *
 * Every layer is a pure async function that takes typed input and returns
 * typed output. This file:
 *   - assembles per-call inputs
 *   - converts layer-level decisions/refusals into the public AnswerResult
 *   - never holds state of its own
 *
 * All side-effecting collaborators (DB, Bedrock) are passed in via `Deps`
 * so unit tests can run the entire pipeline offline with mocks.
 */

import type { ClassifyDeps as SafetyClassifyDeps } from "@hypercare/safety";

import type { GenerateInput, GenerateOutput } from "./bedrock/claude.js";
import { DEFAULT_CONFIG, type RagConfig } from "./config.js";
import { compose } from "./layers/4-compose.js";
import { generate as runGenerate } from "./layers/5-generate.js";
import { ground } from "./layers/3-ground.js";
import { retrieve } from "./layers/2-retrieve.js";
import { rewriteQueryWithMemory } from "./memory/query-rewrite.js";
import { parseMemorySections } from "./memory/section-parse.js";
import { classifySafety } from "./layers/0-safety.js";
import { understandQuestion } from "./layers/1-understand.js";
import { verify } from "./layers/6-verify.js";
import type { TopicClassifyInput, TopicClassifyResult } from "./topics/classifier.js";
import type {
  AnswerInput,
  AnswerResult,
  OperatorMetadata,
  RagUsage,
  RetrievedChunk,
  Stage,
  TopicFields,
} from "./types.js";

export type SearchFn = (q: {
  embedding: number[];
  stage: Stage | null;
  k: number;
}) => Promise<RetrievedChunk[]>;

export type Deps = {
  embed: (text: string) => Promise<number[]>;
  search: SearchFn;
  loadStage: (userId: string) => Promise<Stage | null>;
  generate: (input: GenerateInput) => Promise<GenerateOutput>;
  /** Safety classifier wiring (TASK-010). See `@hypercare/safety`. */
  safety: SafetyClassifyDeps;
  /**
   * Operator observability for top-level pipeline failures (`internal_error`).
   * Same shape as `safety.warn` — structured `ctx` for CloudWatch / log filters.
   */
  warn?: (msg: string, ctx?: Record<string, unknown>) => void;
  /**
   * Invoked when layer 5 has returned (token counts and modelId known), including
   * when layer 6 refuses (`uncitable_response`, `INSUFFICIENT_CONTEXT` →
   * `low_confidence`, etc.). For `kind: "answered"`, the same values appear on
   * `result.usage` — this hook is for logging or cost pipelines without
   * branching on the answer/refusal kind.
   */
  onUsage?: (usage: RagUsage) => void;
  config?: Partial<RagConfig>;
  /**
   * Topic classifier (TASK-022). Fires in parallel with the rest of the pipeline; answer
   * generation does not await the LLM step — only the return path merges the outcome.
   */
  topicClassify: (input: TopicClassifyInput) => Promise<TopicClassifyResult>;
};

function mergeTopics(t: TopicClassifyResult): TopicFields {
  return {
    classifiedTopics: t.topics,
    topicConfidence: t.topics.length > 0 ? t.confidence : null,
  };
}

function opMeta(
  t0: number,
  topRetrievalTier: number | null,
  lastGenerationUsage: RagUsage | null,
): OperatorMetadata {
  return {
    pipelineLatencyMs: Date.now() - t0,
    topRetrievalTier,
    lastGenerationUsage,
  };
}

async function awaitTopic(
  p: Promise<TopicClassifyResult>,
  warn?: Deps["warn"],
): Promise<TopicFields> {
  try {
    const t = await p;
    return mergeTopics(t);
  } catch (err) {
    warn?.("rag.topics.classifier.unexpected", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { classifiedTopics: [], topicConfidence: null };
  }
}

export async function runPipeline(input: AnswerInput, deps: Deps): Promise<AnswerResult> {
  const t0 = Date.now();
  const config: RagConfig = { ...DEFAULT_CONFIG, ...(deps.config ?? {}) };

  const topicP = deps.topicClassify({
    userId: input.userId,
    question: input.question,
    ...(input.priorUserTurn !== undefined ? { priorUserTurn: input.priorUserTurn } : {}),
  });

  try {
    // Layer 0 — Safety.
    const safety = await classifySafety(
      {
        userId: input.userId,
        question: input.question,
        ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
      },
      { classifyDeps: deps.safety },
    );
    if (safety.triaged) {
      return {
        kind: "refused",
        reason: {
          code: "safety_triaged",
          category: safety.category,
          severity: safety.severity,
          suggestedAction: safety.suggestedAction,
          source: safety.source,
          repeat_in_window: safety.repeatInWindow,
        },
        operator: opMeta(t0, null, null),
        ...(await awaitTopic(topicP, deps.warn)),
      };
    }

    // Layer 1 — Understand.
    const understood = understandQuestion({ question: input.question });
    if (understood.scrubbed.length === 0) {
      return {
        kind: "refused",
        reason: { code: "no_content", message: "Empty question after normalization." },
        operator: opMeta(t0, null, null),
        ...(await awaitTopic(topicP, deps.warn)),
      };
    }

    // Stage lookup (pre-layer-2).
    const stage = await deps.loadStage(input.userId);

    const retrievalQuery = rewriteQueryWithMemory(
      understood.scrubbed,
      input.conversationMemoryMd,
      config,
    );

    // Layer 2 — Retrieve.
    const retrieved = await retrieve(
      { scrubbedQuestion: retrievalQuery, stage, k: config.retrievalK },
      { embed: deps.embed, search: deps.search },
    );

    // Layer 3 — Ground.
    const grounded = ground({ hits: retrieved.hits, config });
    if (grounded.decision === "refuse") {
      const top = retrieved.hits[0] as RetrievedChunk | undefined;
      return {
        kind: "refused",
        reason: grounded.reason,
        operator: opMeta(t0, top !== undefined ? top.moduleTier : null, null),
        ...(await awaitTopic(topicP, deps.warn)),
      };
    }

    if (input.conversationMemoryMd?.trim()) {
      const s = parseMemorySections(input.conversationMemoryMd);
      deps.warn?.("rag.memory.prompt_included", {
        conversation_id: input.conversationId,
        has_current_focus: s.hasCurrentFocus,
        has_what_tried: s.hasWhatsTried,
        has_open_threads: s.hasOpenThreads,
        has_signals: s.hasSignals,
      });
    }

    // Layer 4 — Compose.
    const composed = compose({
      scrubbedQuestion: understood.scrubbed,
      chunks: grounded.chunks,
      careProfileContextMd: input.careProfileContextMd ?? null,
      conversationMemoryMd: input.conversationMemoryMd ?? null,
    });

    // Layer 5 — Generate.
    const generated = await runGenerate(
      { systemPrompt: composed.systemPrompt, userPrompt: composed.userPrompt },
      { generate: deps.generate },
    );
    const usage: RagUsage = {
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
      modelId: generated.modelId,
    };
    deps.onUsage?.(usage);

    // Layer 6 — Verify.
    const verified = verify({ rawText: generated.text, sources: composed.sourceMap });
    if (!verified.ok) {
      const top = grounded.chunks[0] as RetrievedChunk | undefined;
      return {
        kind: "refused",
        reason: verified.reason,
        operator: opMeta(
          t0,
          top !== undefined ? top.moduleTier : null,
          usage,
        ),
        ...(await awaitTopic(topicP, deps.warn)),
      };
    }

    const topA = grounded.chunks[0] as RetrievedChunk;
    return {
      kind: "answered",
      text: verified.text,
      citations: verified.citations,
      usage,
      operator: opMeta(t0, topA.moduleTier, usage),
      ...(await awaitTopic(topicP, deps.warn)),
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const q = input.question;
    const questionPreview = q.length <= 120 ? q : q.slice(0, 120);
    deps.warn?.("rag.pipeline.internal_error", {
      errMessage: detail,
      errStack: err instanceof Error ? err.stack : undefined,
      errName: err instanceof Error ? err.name : "NonError",
      userId: input.userId,
      questionPreview,
    });
    return {
      kind: "refused",
      reason: { code: "internal_error", detail },
      operator: opMeta(t0, null, null),
      ...(await awaitTopic(topicP, deps.warn)),
    };
  }
}
