/**
 * Layer 0 — Safety classifier hook (PRD §10, TASK-010).
 *
 * This file is the only plug point between the RAG pipeline and the
 * `@hypercare/safety` classifier. The pipeline calls `classifySafety()` per
 * question; if the result is triaged the orchestrator short-circuits and
 * returns a `safety_triaged` refusal carrying the category + suggestedAction.
 *
 * The classifier itself (rules + Haiku + persistence) lives in
 * `packages/safety`. This layer is just the adapter.
 */

import type { SafetyResult } from "@hypercare/safety";
import { classify } from "@hypercare/safety";
import type { ClassifyDeps } from "@hypercare/safety";

export type SafetyInput = {
  userId: string;
  question: string;
  conversationId?: string;
};

export type SafetyOutput = SafetyResult;

export type SafetyLayerDeps = {
  classifyDeps: ClassifyDeps;
};

export async function classifySafety(
  input: SafetyInput,
  deps: SafetyLayerDeps,
): Promise<SafetyOutput> {
  return classify(
    {
      userId: input.userId,
      text: input.question,
      ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
    },
    deps.classifyDeps,
  );
}
