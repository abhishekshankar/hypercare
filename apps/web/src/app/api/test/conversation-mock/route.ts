import { NextRequest, NextResponse } from "next/server";

import {
  __setRagOverrideForTests,
} from "@/lib/conversation/answer-client";
import { isE2ETestRuntime } from "@/lib/env.test-runtime";
import type { AnswerInput, AnswerResult, OperatorMetadata, RagUsage } from "@hypercare/rag";

function e2eOp(usage: RagUsage | null, tier: number | null = null): OperatorMetadata {
  return {
    pipelineLatencyMs: 10,
    topRetrievalTier: tier,
    lastGenerationUsage: usage,
  };
}

export const dynamic = "force-dynamic";

/**
 * Test-only endpoint (NODE_ENV=test + E2E_SETUP_SECRET).
 *
 * Installs a process-wide override for `rag.answer()` so the Playwright
 * spec can drive the conversation route end-to-end against the real DB
 * without touching Bedrock. Three keyed canned responses cover the three
 * acceptance flows (answered, off_topic, safety_triaged); anything else
 * falls back to a low_confidence refusal so a stray question never hits
 * a real network.
 *
 * `POST /api/test/conversation-mock`         → install
 * `DELETE /api/test/conversation-mock`       → clear
 */

function isAuthorized(request: NextRequest): boolean {
  if (!isE2ETestRuntime()) return false;
  const expected = process.env.E2E_SETUP_SECRET;
  if (!expected) return false;
  return request.headers.get("x-e2e-secret") === expected;
}

const FIXTURE_FN = (input: AnswerInput): Promise<AnswerResult> => {
  const q = input.question.toLowerCase();
  if (/(afternoon agitation|sundowning|agitat)/.test(q)) {
    const usage: RagUsage = {
      inputTokens: null,
      outputTokens: null,
      modelId: "e2e-mock",
    };
    return Promise.resolve({
      kind: "answered",
      text:
        "Late-day agitation is common in dementia [1]. " +
        "Try a calm late-afternoon routine — dim lights, lower noise, and avoid caffeine after lunch [1].",
      citations: [
        {
          chunkId: "00000000-0000-0000-0000-000000000001",
          moduleSlug: "behaviors-sundowning",
          sectionHeading: "What is sundowning",
          attributionLine:
            "Adapted from the Alzheimer's Association caregiver guide, 2024.",
        },
      ],
      usage,
      operator: e2eOp(usage, 1),
      classifiedTopics: [] satisfies string[],
      topicConfidence: null,
    });
  }
  if (/capital of france|paris|weather|sports/.test(q)) {
    return Promise.resolve({
      kind: "refused",
      reason: { code: "off_topic", matched_category: null },
      operator: e2eOp(null, 1),
      classifiedTopics: [] satisfies string[],
      topicConfidence: null,
    });
  }
  if (/kill myself|end it all|hurt myself/.test(q)) {
    return Promise.resolve({
      kind: "refused",
      reason: {
        code: "safety_triaged",
        category: "self_harm_user",
        severity: "high",
        suggestedAction: "call_988",
        source: "rule",
        repeat_in_window: false,
      },
      operator: e2eOp(null, null),
      classifiedTopics: [] satisfies string[],
      topicConfidence: null,
    });
  }
  // TASK-025: drive each remaining PRD §10.3 category in the e2e spec.
  if (/she might hurt herself|wants? to die|cr_self_harm/.test(q)) {
    return Promise.resolve({
      kind: "refused",
      reason: {
        code: "safety_triaged",
        category: "self_harm_cr",
        severity: "high",
        suggestedAction: "call_911",
        source: "rule",
        repeat_in_window: false,
      },
      operator: e2eOp(null, null),
      classifiedTopics: [] satisfies string[],
      topicConfidence: null,
    });
  }
  if (/fell and hit her head|chest pain|not breathing|stroke|wandered|missing/.test(q)) {
    return Promise.resolve({
      kind: "refused",
      reason: {
        code: "safety_triaged",
        category: "acute_medical",
        severity: "high",
        suggestedAction: "call_911",
        source: "rule",
        repeat_in_window: false,
      },
      operator: e2eOp(null, null),
      classifiedTopics: [] satisfies string[],
      topicConfidence: null,
    });
  }
  if (/lost my temper|i pushed her|i hit him today|breaking point|i can'?t take/.test(q)) {
    return Promise.resolve({
      kind: "refused",
      reason: {
        code: "safety_triaged",
        category: "abuse_caregiver_to_cr",
        severity: "high",
        suggestedAction: "call_adult_protective_services",
        source: "rule",
        repeat_in_window: false,
      },
      operator: e2eOp(null, null),
      classifiedTopics: [] satisfies string[],
      topicConfidence: null,
    });
  }
  if (/forced to sign|stolen|exploit|coerced|financial abuse|signed under pressure/.test(q)) {
    return Promise.resolve({
      kind: "refused",
      reason: {
        code: "safety_triaged",
        category: "abuse_cr_to_caregiver",
        severity: "high",
        suggestedAction: "call_adult_protective_services",
        source: "rule",
        repeat_in_window: false,
      },
      operator: e2eOp(null, null),
      classifiedTopics: [] satisfies string[],
      topicConfidence: null,
    });
  }
  if (/double the dose|how much.*give|extra ativan|stop her medication/.test(q)) {
    return Promise.resolve({
      kind: "refused",
      reason: {
        code: "safety_triaged",
        category: "neglect",
        severity: "high",
        suggestedAction: "show_crisis_strip_emphasis",
        source: "rule",
        repeat_in_window: false,
      },
      operator: e2eOp(null, null),
      classifiedTopics: [] satisfies string[],
      topicConfidence: null,
    });
  }
  return Promise.resolve({
    kind: "refused",
    reason: { code: "low_confidence", top_distance: 1.5 },
    operator: e2eOp(null, 1),
    classifiedTopics: [] satisfies string[],
    topicConfidence: null,
  });
};

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  __setRagOverrideForTests(FIXTURE_FN);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  __setRagOverrideForTests(null);
  return NextResponse.json({ ok: true });
}
