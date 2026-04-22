/** Stage labels used for retrieval filtering. Mirrors apps/web/src/lib/onboarding/stage.ts. */
export type Stage = "early" | "middle" | "late";

/** Public input to the pipeline. */
export type AnswerInput = {
  question: string;
  userId: string;
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

export type AnswerResult =
  | { kind: "answered"; text: string; citations: Citation[] }
  | { kind: "refused"; reason: RefusalReason };
