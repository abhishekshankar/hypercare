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
import { classifySafety } from "./layers/0-safety.js";
import { understandQuestion } from "./layers/1-understand.js";
import { verify } from "./layers/6-verify.js";
import type { AnswerInput, AnswerResult, RetrievedChunk, Stage } from "./types.js";

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
  config?: Partial<RagConfig>;
};

export async function runPipeline(input: AnswerInput, deps: Deps): Promise<AnswerResult> {
  const config: RagConfig = { ...DEFAULT_CONFIG, ...(deps.config ?? {}) };

  try {
    // Layer 0 — Safety.
    const safety = await classifySafety(
      { userId: input.userId, question: input.question },
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
        },
      };
    }

    // Layer 1 — Understand.
    const understood = understandQuestion({ question: input.question });
    if (understood.scrubbed.length === 0) {
      return {
        kind: "refused",
        reason: { code: "no_content", message: "Empty question after normalization." },
      };
    }

    // Stage lookup (pre-layer-2).
    const stage = await deps.loadStage(input.userId);

    // Layer 2 — Retrieve.
    const retrieved = await retrieve(
      { scrubbedQuestion: understood.scrubbed, stage, k: config.retrievalK },
      { embed: deps.embed, search: deps.search },
    );

    // Layer 3 — Ground.
    const grounded = ground({ hits: retrieved.hits, config });
    if (grounded.decision === "refuse") {
      return { kind: "refused", reason: grounded.reason };
    }

    // Layer 4 — Compose.
    const composed = compose({
      scrubbedQuestion: understood.scrubbed,
      chunks: grounded.chunks,
    });

    // Layer 5 — Generate.
    const generated = await runGenerate(
      { systemPrompt: composed.systemPrompt, userPrompt: composed.userPrompt },
      { generate: deps.generate },
    );

    // Layer 6 — Verify.
    const verified = verify({ rawText: generated.text, sources: composed.sourceMap });
    if (!verified.ok) {
      return { kind: "refused", reason: verified.reason };
    }

    return { kind: "answered", text: verified.text, citations: verified.citations };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { kind: "refused", reason: { code: "internal_error", detail } };
  }
}
