/**
 * Layer 4 — Compose the prompt.
 *
 * Inputs:
 *  - the (PII-scrubbed) question
 *  - the chunks layer 3 chose, in retrieval order
 *
 * Outputs:
 *  - { systemPrompt, userPrompt, sourceMap } where sourceMap[i] is the
 *    chunk numbered `[i+1]` in the prompt — layer 6 uses it to validate
 *    that every `[n]` citation references a real retrieved chunk.
 *
 * Pure function. Prompt strings are loaded from `src/prompts/*.md` once at
 * module load (see `prompts/loader.ts`); we never inline them in TS.
 */

import { SYSTEM_PROMPT, USER_TEMPLATE } from "../prompts/loader.js";
import type { RetrievedChunk } from "../types.js";

export type ComposeInput = {
  scrubbedQuestion: string;
  chunks: RetrievedChunk[];
};

export type ComposeOutput = {
  systemPrompt: string;
  userPrompt: string;
  /** Index 0 == citation [1], etc. */
  sourceMap: readonly RetrievedChunk[];
};

function renderSource(idx1based: number, chunk: RetrievedChunk): string {
  const heading = chunk.sectionHeading ? ` — ${chunk.sectionHeading}` : "";
  return `[${idx1based}] ${chunk.moduleTitle}${heading}\n${chunk.content.trim()}`;
}

export function compose(input: ComposeInput): ComposeOutput {
  if (input.chunks.length === 0) {
    throw new Error("compose: refusing to build a prompt with zero sources");
  }
  const sourcesBlock = input.chunks
    .map((c, i) => renderSource(i + 1, c))
    .join("\n\n---\n\n");
  const userPrompt = USER_TEMPLATE.replace("{{QUESTION}}", input.scrubbedQuestion).replace(
    "{{SOURCES}}",
    sourcesBlock,
  );
  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    sourceMap: input.chunks,
  };
}
