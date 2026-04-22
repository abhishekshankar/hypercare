import { describe, expect, it } from "vitest";

import { checkRegression } from "../src/report.js";
import type { AnswersReport, RetrievalReport, SafetyReport } from "../src/types.js";

describe("regression check", () => {
  it("fails on recall drop > threshold", () => {
    const prev: RetrievalReport = {
      runner: "retrieval",
      mode: "offline",
      created_at: "x",
      summary: { recall_at_k: 1, k: 5, cases_pass: 30, cases_total: 30, p50_ms: 0, p95_ms: 0 },
      cases: [],
    };
    const cur: RetrievalReport = {
      ...prev,
      summary: { ...prev.summary, recall_at_k: 0.85 },
    };
    const r = checkRegression("retrieval", prev, cur);
    expect(r.ok).toBe(false);
  });

  it("passes on small changes", () => {
    const prev: SafetyReport = {
      runner: "safety",
      mode: "offline",
      created_at: "x",
      summary: {
        triage_precision: 1,
        triage_recall: 1,
        triage_f1: 0.9,
        tp: 1,
        fp: 0,
        fn: 0,
        tn: 0,
        p50_ms: 0,
        p95_ms: 0,
        category_hits: 1,
        category_total: 1,
      },
      category_confusion: [],
      cases: [],
    };
    const cur: SafetyReport = { ...prev, summary: { ...prev.summary, triage_f1: 0.88 } };
    const r = checkRegression("safety", prev, cur);
    expect(r.ok).toBe(true);
  });

  it("fails on verification-refusal rate rise (answers)", () => {
    const prev: AnswersReport = {
      runner: "answers",
      mode: "offline",
      created_at: "x",
      summary: {
        kind_accuracy: 1,
        cited_module_hit_rate: 1,
        answer_hit_rate: 1,
        verification_refusal_rate: 0.05,
        model_id: "m",
        total_input_tokens: 0,
        total_output_tokens: 0,
        p50_ms: 0,
        p95_ms: 0,
        mismatch_breakdown: {},
        refusal_reasons: {
          no_content: 0,
          low_confidence: 0,
          off_topic: 0,
          uncitable_response: 0,
          safety_triaged: 0,
          internal_error: 0,
          verifier_rejected: 0,
          user_cancelled: 0,
        },
      },
      cases: [],
    };
    const cur: AnswersReport = {
      ...prev,
      summary: { ...prev.summary, verification_refusal_rate: 0.2 },
    };
    const r = checkRegression("answers", prev, cur);
    expect(r.ok).toBe(false);
  });
});
