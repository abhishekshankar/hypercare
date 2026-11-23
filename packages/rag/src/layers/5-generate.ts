/**
 * Layer 5 — Generate.
 *
 * One concern: hand the system+user prompts to the answering model and
 * return its raw text. No verification, no parsing — that is layer 6's job.
 *
 * Dependency-injected so unit tests can pass a mock generator and the live
 * test (RAG_LIVE=1) can use the real Bedrock Claude wrapper.
 */

import type { GenerateInput, GenerateOutput } from "../bedrock/claude.js";

export type GenerateLayerInput = {
  systemPrompt: string;
  userPrompt: string;
  /** TASK-042: when set, overrides `BEDROCK_ANSWER_MODEL_ID` / config default for this invoke. */
  modelId?: string;
};

export type GenerateLayerOutput = {
  text: string;
  modelId: string;
  inputTokens: number | null;
  outputTokens: number | null;
  stopReason: string | null;
};

export type GenerateDeps = {
  generate: (input: GenerateInput) => Promise<GenerateOutput>;
};

export async function generate(
  input: GenerateLayerInput,
  deps: GenerateDeps,
): Promise<GenerateLayerOutput> {
  const out = await deps.generate({
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    ...(input.modelId !== undefined ? { modelId: input.modelId } : {}),
  });
  return {
    text: out.text,
    modelId: out.modelId,
    inputTokens: out.inputTokens,
    outputTokens: out.outputTokens,
    stopReason: out.stopReason,
  };
}
