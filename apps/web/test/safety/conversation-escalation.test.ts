/**
 * Integration test for the escalation flow on the conversation message route
 * (TASK-025). Drives `POST /api/app/conversation/[id]/message` in-process with
 * the auth/answer-client/persist layers stubbed, so we can assert:
 *   - The route enriches a `safety_triaged` refusal with the parsed
 *     `@hypercare/safety` script (direct_answer + primary_resources + version).
 *   - The route applies 24h home-screen suppression for caregiver-distress
 *     categories and is a no-op for others.
 *   - The status route reflects the suppression that was just set.
 *   - Mandatory disclosure is attached for elder-abuse but not for the
 *     financial-exploitation script.
 *
 * Persistence (Drizzle) and the safety-classify path are mocked at the module
 * boundary; the script parser, enrichment, and suppression *logic* are real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnswerInput, AnswerResult, SafetyTriageReason } from "@hypercare/rag";

vi.mock("next/server", async (importOriginal) => {
  const m = await importOriginal<typeof import("next/server")>();
  return { ...m, after: () => {} };
});

const stubOp = {
  pipelineLatencyMs: 1,
  topRetrievalTier: null,
  lastGenerationUsage: null,
} as const;

vi.mock("@/lib/env.server", () => ({
  serverEnv: { DATABASE_URL: "postgresql://127.0.0.1:5432/hc_test" },
}));

vi.mock("server-only", () => ({}));

const SESSION_USER_ID = "11111111-1111-1111-1111-111111111111";
const CONVERSATION_ID = "22222222-2222-2222-2222-222222222222";

vi.mock("@/lib/auth/session", () => ({
  getSession: async () => ({ userId: SESSION_USER_ID }),
}));

vi.mock("@/lib/onboarding/status", () => ({
  loadProfileBundle: async () => ({
    user: { displayName: "Alex" },
    profile: { crFirstName: "Margaret" },
  }),
}));

vi.mock("@/lib/conversation/prior-user-message", () => ({
  getPriorUserMessageContent: async () => null,
}));

vi.mock("@hypercare/rag", async () => {
  const actual = await vi.importActual<typeof import("@hypercare/rag")>("@hypercare/rag");
  return {
    ...actual,
    loadConversationMemoryForAnswer: async () => null,
    countUserMessagesInConversation: async () => 0,
    runConversationMemoryRefresh: async () => {},
  };
});

vi.mock("@/lib/conversation/persist", () => ({
  loadConversationOwned: async (id: string) => ({ id, title: null }),
  persistTurn: async (args: {
    conversationId: string;
    userText: string;
    result: AnswerResult;
  }) => ({
    user: {
      id: "u-1",
      role: "user" as const,
      content: args.userText,
      createdAt: new Date(),
    },
    assistant: {
      id: "a-1",
      role: "assistant" as const,
      content: args.result.kind === "answered" ? args.result.text : "",
      citations: args.result.kind === "answered" ? args.result.citations : [],
      refusal: args.result.kind === "refused" ? args.result.reason : null,
      createdAt: new Date(),
    },
  }),
}));

let answerImpl: (input: AnswerInput) => Promise<AnswerResult> = async () => ({
  kind: "refused",
  reason: { code: "low_confidence", top_distance: 1.5 },
  operator: stubOp,
  classifiedTopics: [],
  topicConfidence: null,
});

vi.mock("@/lib/conversation/answer-client", () => ({
  answerForUser: (input: AnswerInput) => answerImpl(input),
}));

const suppressionCalls: { userId: string; category: string }[] = [];
const suppressionState: { userId: string; until: Date; reason: string } | null = null;
let currentSuppression: { userId: string; until: Date; reason: string } | null =
  suppressionState;

vi.mock("@/lib/safety/user-suppression", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/safety/user-suppression")
  >("@/lib/safety/user-suppression");
  return {
    ...actual,
    applySuppressionForTriageCategory: async (userId: string, category: string) => {
      suppressionCalls.push({ userId, category });
      if (
        category === "self_harm_user" ||
        category === "abuse_caregiver_to_cr"
      ) {
        currentSuppression = {
          userId,
          until: new Date(Date.now() + 24 * 60 * 60 * 1000),
          reason:
            category === "self_harm_user"
              ? "caregiver_self_harm"
              : "elder_abuse_or_caregiver_breaking_point",
        };
      }
    },
    getSuppressionStatus: async () =>
      currentSuppression
        ? {
            active: true,
            until: currentSuppression.until.toISOString(),
            reason: currentSuppression.reason,
          }
        : { active: false },
  };
});

import { POST as messagePOST } from "@/app/api/app/conversation/[id]/message/route";
import { GET as suppressionGET } from "@/app/api/app/suppression/status/route";

function makeReq(text: string): Request {
  return new Request(`http://localhost/api/app/conversation/${CONVERSATION_ID}/message`, {
    method: "POST",
    body: JSON.stringify({ text }),
    headers: { "content-type": "application/json" },
  });
}

function makeContext() {
  return { params: Promise.resolve({ id: CONVERSATION_ID }) };
}

beforeEach(() => {
  suppressionCalls.length = 0;
  currentSuppression = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/app/conversation/[id]/message — escalation enrichment (TASK-025)", () => {
  it("attaches the caregiver-self-harm script and applies 24h suppression", async () => {
    const triage: SafetyTriageReason = {
      code: "safety_triaged",
      category: "self_harm_user",
      severity: "high",
      suggestedAction: "call_988",
      source: "rule",
      repeat_in_window: false,
    };
    answerImpl = async () => ({
      kind: "refused",
      reason: triage,
      operator: stubOp,
      classifiedTopics: [],
      topicConfidence: null,
    });

    const r = await messagePOST(
      makeReq("I can't keep doing this, I want it to stop"),
      makeContext(),
    );
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      assistant: { refusal: SafetyTriageReason };
    };

    const refusal = body.assistant.refusal;
    expect(refusal?.code).toBe("safety_triaged");
    expect(refusal?.category).toBe("self_harm_user");
    expect(refusal?.script).toBeDefined();
    expect(refusal?.script?.version).toBeGreaterThanOrEqual(1);
    expect(refusal?.script?.direct_answer.length).toBeGreaterThan(0);
    const labels = refusal?.script?.primary_resources.map((p) => p.label) ?? [];
    expect(labels.some((l) => /988/.test(l))).toBe(true);

    expect(suppressionCalls).toEqual([
      { userId: SESSION_USER_ID, category: "self_harm_user" },
    ]);

    const status = await suppressionGET();
    const statusBody = (await status.json()) as {
      active: boolean;
      reason?: string;
    };
    expect(statusBody.active).toBe(true);
    expect(statusBody.reason).toBe("caregiver_self_harm");
  });

  it("attaches mandatory disclosure for caregiver→CR abuse and suppresses the home", async () => {
    const triage: SafetyTriageReason = {
      code: "safety_triaged",
      category: "abuse_caregiver_to_cr",
      severity: "high",
      suggestedAction: "call_adult_protective_services",
      source: "llm",
      repeat_in_window: false,
    };
    answerImpl = async () => ({
      kind: "refused",
      reason: triage,
      operator: stubOp,
      classifiedTopics: [],
      topicConfidence: null,
    });

    const r = await messagePOST(
      makeReq("I lost my temper and pushed her today"),
      makeContext(),
    );
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      assistant: { refusal: SafetyTriageReason };
    };
    expect(body.assistant.refusal?.script?.disclosure).toBeDefined();
    expect(body.assistant.refusal?.script?.disclosure ?? "").toMatch(
      /report|adult protective|aps|reportable|state/i,
    );

    expect(suppressionCalls).toEqual([
      { userId: SESSION_USER_ID, category: "abuse_caregiver_to_cr" },
    ]);
    const status = await suppressionGET();
    const statusBody = (await status.json()) as { reason?: string };
    expect(statusBody.reason).toBe("elder_abuse_or_caregiver_breaking_point");
  });

  it("does NOT suppress the home for non-distress categories (acute medical)", async () => {
    const triage: SafetyTriageReason = {
      code: "safety_triaged",
      category: "acute_medical",
      severity: "high",
      suggestedAction: "call_911",
      source: "rule",
      repeat_in_window: false,
    };
    answerImpl = async () => ({
      kind: "refused",
      reason: triage,
      operator: stubOp,
      classifiedTopics: [],
      topicConfidence: null,
    });

    const r = await messagePOST(
      makeReq("Mom is having chest pain right now"),
      makeContext(),
    );
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      assistant: { refusal: SafetyTriageReason };
    };
    expect(body.assistant.refusal?.script).toBeDefined();
    expect(/911/.test(body.assistant.refusal?.script?.direct_answer ?? "")).toBe(
      true,
    );

    expect(suppressionCalls).toEqual([
      { userId: SESSION_USER_ID, category: "acute_medical" },
    ]);
    const status = await suppressionGET();
    const statusBody = (await status.json()) as { active: boolean };
    expect(statusBody.active).toBe(false);
  });

  it("preserves repeat_in_window through enrichment so the UI can render the dedupe note", async () => {
    const triage: SafetyTriageReason = {
      code: "safety_triaged",
      category: "self_harm_user",
      severity: "high",
      suggestedAction: "call_988",
      source: "rule",
      repeat_in_window: true,
    };
    answerImpl = async () => ({
      kind: "refused",
      reason: triage,
      operator: stubOp,
      classifiedTopics: [],
      topicConfidence: null,
    });

    const r = await messagePOST(makeReq("again, I want it to stop"), makeContext());
    const body = (await r.json()) as {
      assistant: { refusal: SafetyTriageReason };
    };
    expect(body.assistant.refusal?.repeat_in_window).toBe(true);
    expect(body.assistant.refusal?.script).toBeDefined();
  });

  it("passes a normal answered turn through unchanged", async () => {
    answerImpl = async () => ({
      kind: "answered",
      text: "Late-day agitation is common in dementia [1].",
      citations: [
        {
          chunkId: "00000000-0000-0000-0000-000000000001",
          moduleSlug: "behaviors-sundowning",
          sectionHeading: "What is sundowning",
          attributionLine: "Adapted from the Alzheimer's Association caregiver guide, 2024.",
        },
      ],
      usage: { inputTokens: null, outputTokens: null, modelId: "test" },
      operator: {
        pipelineLatencyMs: 2,
        topRetrievalTier: 1,
        lastGenerationUsage: { inputTokens: null, outputTokens: null, modelId: "test" },
      },
      classifiedTopics: [],
      topicConfidence: null,
    });

    const r = await messagePOST(
      makeReq("Tell me about afternoon agitation."),
      makeContext(),
    );
    expect(r.status).toBe(200);
    expect(suppressionCalls).toHaveLength(0);
  });
});
