/** Stage labels used for retrieval filtering. Mirrors apps/web/src/lib/onboarding/stage.ts. */
export type Stage = "early" | "middle" | "late";

/** Public input to the pipeline. */
export type AnswerInput = {
  question: string;
  userId: string;
  /** Optional last user line for short-followup topic disambiguation (TASK-022). */
  priorUserTurn?: string | null;
};

/** Carried on every `AnswerResult` for persistence on the user `messages` row. */
export type TopicFields = {
  /** 0–3 `topics.slug` values (empty for assistant / errors). */
  classifiedTopics: string[];
  /** Model confidence in [0,1] when `classifiedTopics` is non-empty; else null. */
  topicConfidence: number | null;
};

/** A chunk row joined with its parent module — the unit retrieval and verification operate on. */
export type RetrievedChunk = {
  chunkId: string;
  moduleId: string;
  moduleSlug: string;
  moduleTitle: string;
  category: string;
  attributionLine: string;
  sectionHeading: string;
  stageRelevance: readonly string[];
  chunkIndex: number;
  content: string;
  /** pgvector cosine distance: 0 = identical, 2 = opposite. Lower is better. */
  distance: number;
};

export type Citation = {
  chunkId: string;
  moduleSlug: string;
  sectionHeading: string;
  attributionLine: string;
};

/**
 * Discriminated union — every refusal carries a machine-readable code.
 * Layer 3 produces no_content / low_confidence / off_topic.
 * Layer 6 produces uncitable_response.
 * Layer 0 (TASK-010) produces safety_triaged with classifier metadata
 * (`category` + `suggestedAction` + `severity` + `source`) so the chat surface
 * can render the right escalation flow without re-classifying.
 * Pipeline produces internal_error on unexpected throws.
 */
export type SafetyTriageReason = {
  code: "safety_triaged";
  category:
    | "self_harm_user"
    | "self_harm_cr"
    | "acute_medical"
    | "abuse_cr_to_caregiver"
    | "abuse_caregiver_to_cr"
    | "neglect";
  severity: "high" | "medium";
  suggestedAction:
    | "call_988"
    | "call_911"
    | "call_adult_protective_services"
    | "show_crisis_strip_emphasis";
  source: "rule" | "llm";
};

export type RefusalReason =
  | { code: "no_content"; message: string }
  | { code: "low_confidence"; top_distance: number }
  | { code: "off_topic"; matched_category: string | null }
  | { code: "uncitable_response"; stripped_sentences: number }
  | SafetyTriageReason
  | { code: "internal_error"; detail: string };

/**
 * Bedrock-reported token counts from the generation step (layer 5), for
 * operator-facing cost/telemetry. Only present on `kind: "answered"`.
 * Refusals that occur before generation, or `refused` after generation, do
 * not carry this field (use `deps.onUsage` if you need post-generation
 * token counts on refusal paths such as `uncitable_response` or
 * `low_confidence` from `INSUFFICIENT_CONTEXT`).
 */
export type RagUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  modelId: string;
};

export type AnswerResult =
  | ({ kind: "answered"; text: string; citations: Citation[]; usage: RagUsage } & TopicFields)
  | ({ kind: "refused"; reason: RefusalReason } & TopicFields);
