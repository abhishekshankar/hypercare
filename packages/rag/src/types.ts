import type { ClassifierVerdict } from "@alongside/model-router";

/** Stage labels used for retrieval filtering. Mirrors apps/web/src/lib/onboarding/stage.ts. */
export type Stage = "early" | "middle" | "late";

/** Public input to the pipeline. */
export type AnswerInput = {
  question: string;
  userId: string;
  /**
   * TASK-042: `users.routing_cohort` for model routing A/B. When `MODEL_ROUTING=1`, callers
   * should pass the DB value (or deterministic fallback); when unset, routing is skipped.
   */
  routingCohort?: string | null;
  /** Optional last user line for short-followup topic disambiguation (TASK-022). */
  priorUserTurn?: string | null;
  /** When present, safety `safety_flags` dedupe + linkage use this (TASK-025). */
  conversationId?: string;
  /**
   * Pre-rendered markdown from `care_profile` (apps/web). Injected above sources; not a citation.
   * TASK-027.
   */
  careProfileContextMd?: string | null;
  /**
   * Rolling conversation summary from `conversation_memory` when valid (not invalidated).
   * TASK-027.
   */
  conversationMemoryMd?: string | null;
};

/** Filled in server-side in apps/web from markdown scripts (not bundled to client). */
export type SafetyEscalationScript = {
  version: number;
  reviewed_by: string;
  reviewed_on: string;
  next_review_due: string;
  direct_answer: string;
  body_md: string;
  primary_resources: Array<{ label: string; href: string; primary?: boolean }>;
  disclosure?: string;
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
  /** Parent `modules.tier` (1 = Tier-1 reviewed modules, …). */
  moduleTier: number;
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
  /** Deduplicated repeat inside the 5-minute window (TASK-025). */
  repeat_in_window?: boolean;
  /** Set by apps/web from `@alongside/safety` scripts; omitted until enrichment. */
  script?: SafetyEscalationScript;
};

export type RefusalReason =
  | { code: "no_content"; message: string }
  | { code: "low_confidence"; top_distance: number }
  | { code: "off_topic"; matched_category: string | null }
  | { code: "uncitable_response"; stripped_sentences: number }
  | SafetyTriageReason
  | { code: "internal_error"; detail: string }
  /** Layer 6 fast-path (regex) caught unsafe partial output mid-stream (TASK-031). */
  | { code: "verifier_rejected"; message?: string }
  /** User aborted streaming (Escape); assistant text is not persisted (TASK-031). */
  | { code: "user_cancelled" };

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

/**
 * Persisted to `messages` for the operator metrics page (TASK-029).
 * Present on every `AnswerResult` from `runPipeline`.
 */
export type OperatorMetadata = {
  pipelineLatencyMs: number;
  topRetrievalTier: number | null;
  /**
   * Layer-5 token usage when generation ran; null when the pipeline refused
   * before or without a successful generation call.
   */
  lastGenerationUsage: RagUsage | null;
};

/** TASK-042: persisted to `model_routing_decisions` after the assistant row exists. */
export type RoutingAuditPayload = {
  userId: string;
  cohort: string;
  classifierVerdict: ClassifierVerdict;
  policyVersion: number;
  matchedRuleIndex: number | null;
  modelId: string;
  reason: string;
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
};

type RoutingFields = { routingAudit?: RoutingAuditPayload };

export type AnswerResult =
  | ({ kind: "answered"; text: string; citations: Citation[]; usage: RagUsage; operator: OperatorMetadata } & TopicFields & RoutingFields)
  | ({ kind: "refused"; reason: RefusalReason; operator: OperatorMetadata } & TopicFields & RoutingFields);
