import type { RefusalReason, SafetyTriageReason } from "@hypercare/rag";
import type { SafetyCategory } from "@hypercare/safety";

// --- Golden file shapes (kept in sync with TASK-012) ---

export type RetrievalGoldenCase = {
  id: string;
  question: string;
  stage: "early" | "middle" | "late" | null;
  expected_modules: string[];
  expected_not_modules?: string[];
  notes?: string;
};

export type SafetyGoldenCase = {
  id: string;
  text: string;
  expected_triaged: boolean;
  expected_category?: SafetyCategory;
  notes?: string;
};

export type AnswerGoldenCase = {
  id: string;
  question: string;
  stage: "early" | "middle" | "late" | null;
  expected_kind: "answered" | "refused";
  expected_refusal_code?: RefusalReason["code"];
  expected_cited_modules?: string[];
  notes?: string;
};

// --- Report bundles ---

export type RetrievalCaseReport = {
  id: string;
  pass: boolean;
  top_module_slugs: string[];
  first_expected_rank: number | null;
  expected_modules: string[];
  violations_not: string[];
  latency_ms: number;
  notes?: string;
};

export type RetrievalReportSummary = {
  recall_at_k: number;
  k: number;
  cases_pass: number;
  cases_total: number;
  p50_ms: number;
  p95_ms: number;
};

export type RetrievalReport = {
  runner: "retrieval";
  mode: "offline" | "live";
  created_at: string;
  summary: RetrievalReportSummary;
  cases: RetrievalCaseReport[];
};

export type ConfusionEntry = { expected: SafetyCategory; predicted: SafetyCategory; count: number };

export type SafetyCaseReport = {
  id: string;
  /** Overall: triage + category (when triage expected) both match. */
  pass: boolean;
  pass_triage: boolean;
  pass_category: boolean | "n/a";
  expected_triaged: boolean;
  actual_triaged: boolean;
  expected_category?: SafetyCategory;
  actual_category?: SafetyCategory;
  latency_ms: number;
  notes?: string;
};

export type SafetyReportSummary = {
  triage_precision: number;
  triage_recall: number;
  triage_f1: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  p50_ms: number;
  p95_ms: number;
  category_hits: number;
  category_total: number;
};

export type SafetyReport = {
  runner: "safety";
  mode: "offline" | "live";
  created_at: string;
  summary: SafetyReportSummary;
  category_confusion: ConfusionEntry[];
  cases: SafetyCaseReport[];
};

export type MismatchKind =
  | "ok"
  | "kind_mismatch"
  | "citation_mismatch"
  | "safety_triage"
  | "refusal_code_mismatch";

export type AnswerCaseReport = {
  id: string;
  pass: boolean;
  mismatch: MismatchKind;
  expected_kind: "answered" | "refused";
  actual_kind: "answered" | "refused";
  expected_cited_modules?: string[];
  cited_module_slugs: string[];
  reason_code: RefusalReason["code"] | null;
  /** Populated for `internal_error` — operator/eval triage (not shown to end users). */
  reason_detail?: string;
  verification_refused: boolean;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  model_id: string;
  notes?: string;
};

export type RefusalReasonCounts = {
  no_content: number;
  low_confidence: number;
  off_topic: number;
  uncitable_response: number;
  safety_triaged: number;
  internal_error: number;
  verifier_rejected: number;
  user_cancelled: number;
};

export type AnswersReportSummary = {
  kind_accuracy: number;
  cited_module_hit_rate: number;
  answer_hit_rate: number;
  verification_refusal_rate: number;
  model_id: string;
  total_input_tokens: number;
  total_output_tokens: number;
  p50_ms: number;
  p95_ms: number;
  mismatch_breakdown: Record<string, number>;
  refusal_reasons: RefusalReasonCounts;
  /**
   * When any case ends in `internal_error`, how many distinct first lines of
   * `reason_detail` appear (same root cause vs. many failures).
   */
  internal_error_distinct_first_lines?: number;
};

export type AnswersReport = {
  runner: "answers";
  mode: "offline" | "live";
  created_at: string;
  summary: AnswersReportSummary;
  cases: AnswerCaseReport[];
};

export type AnyReport = RetrievalReport | SafetyReport | AnswersReport;

function isSafetyTriage(
  r: RefusalReason,
): r is SafetyTriageReason {
  return r.code === "safety_triaged";
}

export function refusalCodeOf(reason: RefusalReason): string {
  if (isSafetyTriage(reason)) return "safety_triaged";
  return reason.code;
}

export function countRefusalKind(
  reasons: Array<RefusalReason["code"] | "answered" | null>,
): RefusalReasonCounts {
  const z: RefusalReasonCounts = {
    no_content: 0,
    low_confidence: 0,
    off_topic: 0,
    uncitable_response: 0,
    safety_triaged: 0,
    internal_error: 0,
    verifier_rejected: 0,
    user_cancelled: 0,
  };
  for (const r of reasons) {
    if (r === "answered" || r === null) continue;
    if (r in z) (z as Record<keyof RefusalReasonCounts, number>)[r] += 1;
  }
  return z;
}
