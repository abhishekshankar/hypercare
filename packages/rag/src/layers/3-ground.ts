/**
 * Layer 3 — Grounding decision.
 *
 * Looks at the retrieved hits and decides:
 *   (a) "good enough" → forward up to `maxChunksForPrompt` to layer 4, or
 *   (b) refuse with a typed reason — no_content / low_confidence / off_topic.
 *
 * Thresholds live in `config.ts` so evals (TASK-012) can tune them without
 * editing this file. The current defaults are heuristic placeholders.
 *
 * "off_topic" is the same shape as "low_confidence" but distinguishes the
 * single-bad-hit case (top-1 distance very high — not just "okay-but-weak").
 * For v0 we treat anything with top-1 > 0.85 as off-topic; below that we use
 * the regular confidence rule.
 */

import type { RagConfig } from "../config.js";
import type { RefusalReason, RetrievedChunk } from "../types.js";

export type GroundInput = {
  hits: RetrievedChunk[];
  config: RagConfig;
};

export type GroundOutput =
  | { decision: "answer"; chunks: RetrievedChunk[] }
  | { decision: "refuse"; reason: RefusalReason };

const OFF_TOPIC_DISTANCE = 0.85;

export function ground(input: GroundInput): GroundOutput {
  const { hits, config } = input;

  if (hits.length === 0) {
    return {
      decision: "refuse",
      reason: { code: "no_content", message: "No published content matched the question." },
    };
  }

  const top = hits[0]!;
  if (top.distance > OFF_TOPIC_DISTANCE) {
    return {
      decision: "refuse",
      reason: { code: "off_topic", matched_category: top.category ?? null },
    };
  }

  if (top.distance > config.top1DistanceThreshold) {
    return {
      decision: "refuse",
      reason: { code: "low_confidence", top_distance: top.distance },
    };
  }

  const secondaryCount = hits.filter(
    (h) => h.distance <= config.secondaryDistanceThreshold,
  ).length;
  if (secondaryCount < config.secondaryMinHits) {
    return {
      decision: "refuse",
      reason: { code: "low_confidence", top_distance: top.distance },
    };
  }

  return { decision: "answer", chunks: hits.slice(0, config.maxChunksForPrompt) };
}
