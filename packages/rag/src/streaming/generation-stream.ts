/**
 * Layer 5 streaming + Layer 6 full verify + progressive fast-path commits (TASK-031).
 */

import type { GenerateInput } from "../bedrock/claude.js";
import { invokeClaudeStream, type StreamChunk } from "../bedrock/claude.js";
import { verify } from "../layers/6-verify.js";
import { opMeta, type Deps, type PipelineComposeReady } from "../pipeline.js";
import type { AnswerResult, RagUsage, RoutingAuditPayload } from "../types.js";
import { findNextCommitEnd } from "./commit-buffer.js";
import { fastPathVerifyChunk } from "./fast-path-verifier.js";

async function* defaultStream(
  input: GenerateInput,
  opts?: { signal?: AbortSignal },
): AsyncGenerator<StreamChunk, void, undefined> {
  yield* invokeClaudeStream(input, opts);
}

function tryCommitDraft(
  draft: string,
  committedUpto: number,
  ready: PipelineComposeReady,
  emit: (s: string) => void,
): number {
  let c = committedUpto;
  const cfg = {
    minChars: ready.config.streamCommitMinChars,
    tailReserve: ready.config.streamCommitTailReserve,
  };
  for (;;) {
    const end = findNextCommitEnd(draft, c, cfg);
    if (end === null) break;
    const slice = draft.slice(c, end);
    const fp = fastPathVerifyChunk(slice);
    if (!fp.ok) {
      return -1;
    }
    emit(slice);
    c = end;
  }
  return c;
}

export type StreamGenerationOptions = {
  signal?: AbortSignal;
  onCommittedText: (delta: string) => void;
  onFirstCommittedByte?: () => void;
};

/**
 * Stream generation from a compose-ready context; invokes `onCommittedText` only for
 * verifier-approved prefixes. Returns final `AnswerResult` (answered or refused).
 */
export async function runStreamingGeneration(
  ready: PipelineComposeReady,
  deps: Deps,
  opts: StreamGenerationOptions,
): Promise<AnswerResult> {
  const { composed, topicFields } = ready;
  const genModelId =
    ready.modelRoutingActive && ready.routeDecision !== null
      ? ready.routeDecision.modelId
      : ready.config.answerModelId;
  const genInput: GenerateInput = {
    systemPrompt: composed.systemPrompt,
    userPrompt: composed.userPrompt,
    maxTokens: ready.config.answerMaxTokens,
    temperature: ready.config.answerTemperature,
    modelId: genModelId,
    region: ready.config.answerRegion,
  };

  const streamFn = deps.generateStream ?? defaultStream;

  function routingAuditPayload(usageArg: RagUsage | null, pipelineLatencyMs: number): RoutingAuditPayload | undefined {
    if (!ready.modelRoutingActive || ready.routeDecision === null || ready.classifierVerdict === null) {
      return undefined;
    }
    return {
      userId: ready.routingUserId,
      cohort: ready.routingCohort ?? "routing_v1_control",
      classifierVerdict: ready.classifierVerdict,
      policyVersion: ready.routeDecision.policyVersion,
      matchedRuleIndex: ready.routeDecision.matchedRuleIndex,
      modelId: usageArg?.modelId ?? genModelId,
      reason: ready.routeDecision.reason,
      latencyMs: pipelineLatencyMs,
      tokensIn: usageArg?.inputTokens ?? null,
      tokensOut: usageArg?.outputTokens ?? null,
    };
  }

  let draft = "";
  let committedUpto = 0;
  let emittedSoFar = "";
  let firstByte = false;
  let usage: RagUsage | null = null;

  const commitEmit = (s: string) => {
    if (!firstByte) {
      firstByte = true;
      opts.onFirstCommittedByte?.();
    }
    emittedSoFar += s;
    opts.onCommittedText(s);
  };

  try {
    const streamIterable =
      opts.signal !== undefined
        ? streamFn(genInput, { signal: opts.signal })
        : streamFn(genInput);
    for await (const ev of streamIterable) {
      if (opts.signal?.aborted) {
        const op = opMeta(ready.t0, ready.topRetrievalTier, usage);
        const ra = routingAuditPayload(usage, op.pipelineLatencyMs);
        return {
          kind: "refused",
          reason: { code: "user_cancelled" },
          operator: op,
          ...topicFields,
          ...(ra !== undefined ? { routingAudit: ra } : {}),
        };
      }
      if (ev.kind === "text") {
        draft += ev.text;
        const next = tryCommitDraft(draft, committedUpto, ready, commitEmit);
        if (next === -1) {
          const op = opMeta(ready.t0, ready.topRetrievalTier, usage);
          const ra = routingAuditPayload(usage, op.pipelineLatencyMs);
          return {
            kind: "refused",
            reason: {
              code: "verifier_rejected",
              message: "Fast-path verifier rejected streamed output.",
            },
            operator: op,
            ...topicFields,
            ...(ra !== undefined ? { routingAudit: ra } : {}),
          };
        }
        committedUpto = next;
      } else if (ev.kind === "usage") {
        usage = {
          inputTokens: ev.inputTokens,
          outputTokens: ev.outputTokens,
          modelId: ev.modelId,
        };
      }
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    deps.warn?.("rag.pipeline.streaming_error", { detail });
    const op = opMeta(ready.t0, ready.topRetrievalTier, usage);
    const ra = routingAuditPayload(usage, op.pipelineLatencyMs);
    return {
      kind: "refused",
      reason: { code: "internal_error", detail },
      operator: op,
      ...topicFields,
      ...(ra !== undefined ? { routingAudit: ra } : {}),
    };
  }

  if (opts.signal?.aborted) {
    const op = opMeta(ready.t0, ready.topRetrievalTier, usage);
    const ra = routingAuditPayload(usage, op.pipelineLatencyMs);
    return {
      kind: "refused",
      reason: { code: "user_cancelled" },
      operator: op,
      ...topicFields,
      ...(ra !== undefined ? { routingAudit: ra } : {}),
    };
  }

  if (usage) {
    deps.onUsage?.(usage);
  }

  const verified = verify({ rawText: draft, sources: composed.sourceMap });
  if (!verified.ok) {
    const op = opMeta(ready.t0, ready.topRetrievalTier, usage);
    const ra = routingAuditPayload(usage, op.pipelineLatencyMs);
    return {
      kind: "refused",
      reason: verified.reason,
      operator: op,
      ...topicFields,
      ...(ra !== undefined ? { routingAudit: ra } : {}),
    };
  }

  const eNorm = emittedSoFar.trimStart();
  const tail = verified.text.startsWith(eNorm)
    ? verified.text.slice(eNorm.length)
    : verified.text;
  if (tail.length > 0) {
    const fp = fastPathVerifyChunk(tail);
    if (!fp.ok) {
      const op = opMeta(ready.t0, ready.topRetrievalTier, usage);
      const ra = routingAuditPayload(usage, op.pipelineLatencyMs);
      return {
        kind: "refused",
        reason: { code: "verifier_rejected", message: `Fast-path: ${fp.reason}` },
        operator: op,
        ...topicFields,
        ...(ra !== undefined ? { routingAudit: ra } : {}),
      };
    }
    commitEmit(tail);
  }

  const finalUsage: RagUsage =
    usage ?? { inputTokens: null, outputTokens: null, modelId: genModelId };

  const op = opMeta(ready.t0, ready.topRetrievalTier, usage);
  const ra = routingAuditPayload(finalUsage, op.pipelineLatencyMs);

  return {
    kind: "answered",
    text: verified.text,
    citations: verified.citations,
    usage: finalUsage,
    operator: op,
    ...topicFields,
    ...(ra !== undefined ? { routingAudit: ra } : {}),
  };
}
