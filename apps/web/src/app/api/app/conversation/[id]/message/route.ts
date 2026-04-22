import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { answerForUser } from "@/lib/conversation/answer-client";
import {
  countUserMessagesInConversation,
  invokeClaude,
  loadConversationMemoryForAnswer,
  runConversationMemoryRefresh,
  type MemoryRefreshLog,
} from "@hypercare/rag";
import { getPriorUserMessageContent } from "@/lib/conversation/prior-user-message";
import { loadConversationOwned, persistTurn } from "@/lib/conversation/persist";
import { enrichSafetyTriageReason } from "@/lib/safety/enrich-triage";
import { applySuppressionForTriageCategory } from "@/lib/safety/user-suppression";
import { loadProfileBundle } from "@/lib/onboarding/status";
import { buildCareProfileContextMd } from "@/lib/rag/care-profile-context";
import { serverEnv } from "@/lib/env.server";
import type { AnswerResult } from "@hypercare/rag";

export const dynamic = "force-dynamic";

const MessageSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: conversationId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = MessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const owned = await loadConversationOwned(conversationId, session.userId);
  if (!owned) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const priorUserTurn = await getPriorUserMessageContent(conversationId);
  const { profile } = await loadProfileBundle(session.userId);
  const careProfileContextMd = buildCareProfileContextMd(profile);
  const mem = await loadConversationMemoryForAnswer(
    serverEnv.DATABASE_URL,
    conversationId,
    session.userId,
  );
  const conversationMemoryMd = mem?.summaryMd ?? null;

  let result: AnswerResult = await answerForUser({
    question: parsed.data.text,
    userId: session.userId,
    conversationId,
    priorUserTurn: priorUserTurn ?? null,
    careProfileContextMd,
    conversationMemoryMd,
  });

  if (result.kind === "refused" && result.reason.code === "safety_triaged") {
    const { user, profile } = await loadProfileBundle(session.userId);
    const crName = profile?.crFirstName?.trim() || "them";
    const cg = user.displayName?.trim();
    const enriched = enrichSafetyTriageReason(result.reason, parsed.data.text, {
      crName,
      ...(cg !== undefined && cg !== "" ? { caregiverName: cg } : {}),
    });
    result = { ...result, reason: enriched };
    await applySuppressionForTriageCategory(session.userId, enriched.category);
  }

  const turn = await persistTurn({
    conversationId,
    userText: parsed.data.text,
    result,
  });

  after(() => {
    const dbUrl = serverEnv.DATABASE_URL;
    void (async () => {
      const n = await countUserMessagesInConversation(dbUrl, conversationId);
      await runConversationMemoryRefresh({
        databaseUrl: dbUrl,
        conversationId,
        userId: session.userId,
        userMessageCount: n,
        generate: invokeClaude,
        warn: (m: string, c?: Record<string, unknown>) => console.warn(m, c ?? {}),
        log: (e: MemoryRefreshLog) => console.warn("rag.memory.refresh", e),
      });
    })().catch((err) => console.warn("conversation_memory_refresh", err));
  });

  return NextResponse.json({
    user: {
      id: turn.user.id,
      role: "user" as const,
      content: turn.user.content,
      createdAt: turn.user.createdAt.toISOString(),
    },
    assistant: {
      id: turn.assistant.id,
      role: "assistant" as const,
      content: turn.assistant.content,
      citations: turn.assistant.citations,
      refusal: turn.assistant.refusal,
      createdAt: turn.assistant.createdAt.toISOString(),
    },
  });
}
