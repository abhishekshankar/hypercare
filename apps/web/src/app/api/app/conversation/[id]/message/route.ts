import { after } from "next/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { answerForUser, hasActiveRagOverride } from "@/lib/conversation/answer-client";
import {
  buildDefaultDeps,
  countUserMessagesInConversation,
  invokeClaude,
  loadConversationMemoryForAnswer,
  runConversationMemoryRefresh,
  runPipelineThroughCompose,
  runStreamingGeneration,
  type MemoryRefreshLog,
} from "@alongside/rag";
import { getPriorUserMessageContent } from "@/lib/conversation/prior-user-message";
import {
  loadConversationOwned,
  persistAssistantMessage,
  persistTurn,
  persistUserMessageOnly,
} from "@/lib/conversation/persist";
import { persistModelRoutingDecisionIfEnabled } from "@/lib/conversation/persist-model-routing";
import { enrichSafetyTriageReason } from "@/lib/safety/enrich-triage";
import { applySuppressionForTriageCategory } from "@/lib/safety/user-suppression";
import { loadProfileBundle } from "@/lib/onboarding/status";
import { buildCareProfileContextMd } from "@/lib/rag/care-profile-context";
import { serverEnv, streamingAnswersEnabled } from "@/lib/env.server";
import { createDbClient, routingCohortFromUserId, users } from "@alongside/db";
import type { AnswerResult } from "@alongside/rag";

export const dynamic = "force-dynamic";

const MessageSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

function scheduleConversationMemoryRefresh(conversationId: string, userId: string) {
  after(() => {
    const dbUrl = serverEnv.DATABASE_URL;
    void (async () => {
      const n = await countUserMessagesInConversation(dbUrl, conversationId);
      await runConversationMemoryRefresh({
        databaseUrl: dbUrl,
        conversationId,
        userId,
        userMessageCount: n,
        generate: invokeClaude,
        warn: (m: string, c?: Record<string, unknown>) => console.warn(m, c ?? {}),
        log: (e: MemoryRefreshLog) => console.warn("rag.memory.refresh", e),
      });
    })().catch((err) => console.warn("conversation_memory_refresh", err));
  });
}

function jsonTurnBody(turn: {
  user: { id: string; content: string; createdAt: Date };
  assistant: {
    id: string;
    content: string;
    citations: unknown;
    refusal: unknown;
    createdAt: Date;
    rating: "up" | "down" | null;
    ratingInvited: boolean;
  };
}) {
  return {
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
      rating: turn.assistant.rating,
      ratingInvited: turn.assistant.ratingInvited,
    },
  };
}

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

  const postReceiptMs = Date.now();
  const priorUserTurn = await getPriorUserMessageContent(conversationId);
  const { profile } = await loadProfileBundle(session.userId);
  const careProfileContextMd = buildCareProfileContextMd(profile);
  const mem = await loadConversationMemoryForAnswer(
    serverEnv.DATABASE_URL,
    conversationId,
    session.userId,
  );
  const conversationMemoryMd = mem?.summaryMd ?? null;

  const db = createDbClient(serverEnv.DATABASE_URL);
  const [uRow] = await db
    .select({ routingCohort: users.routingCohort })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  const routingCohort = uRow?.routingCohort ?? routingCohortFromUserId(session.userId);

  const answerInput = {
    question: parsed.data.text,
    userId: session.userId,
    conversationId,
    priorUserTurn: priorUserTurn ?? null,
    careProfileContextMd,
    conversationMemoryMd,
    routingCohort,
  };

  const accept = request.headers.get("accept") ?? "";
  const useSse =
    streamingAnswersEnabled() &&
    !hasActiveRagOverride() &&
    accept.includes("text/event-stream");

  if (!useSse) {
    /**
     * Legacy JSON path (default). Deprecated for interactive clients once streaming is on;
     * keep for `Accept: application/json` and E2E mocks (TASK-031).
     */
    let result: AnswerResult = await answerForUser(answerInput);

    if (result.kind === "refused" && result.reason.code === "safety_triaged") {
      const { user, profile: prof } = await loadProfileBundle(session.userId);
      const crName = prof?.crFirstName?.trim() || "them";
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

    await persistModelRoutingDecisionIfEnabled({
      assistantMessageId: turn.assistant.id,
      result,
    });

    scheduleConversationMemoryRefresh(conversationId, session.userId);

    return NextResponse.json(jsonTurnBody(turn));
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const deps = buildDefaultDeps({ databaseUrl: serverEnv.DATABASE_URL });
      const logCtx = {
        conversation_id: conversationId,
        user_id: session.userId,
      };

      try {
        const head = await runPipelineThroughCompose(answerInput, deps);
        if (head.outcome === "refused") {
          let result = head.result;
          if (result.kind === "refused" && result.reason.code === "safety_triaged") {
            const { user, profile: prof } = await loadProfileBundle(session.userId);
            const crName = prof?.crFirstName?.trim() || "them";
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
          send("refusal", {
            ...jsonTurnBody(turn),
          });
          console.info("rag.stream.refusal_pre_generation", {
            ...logCtx,
            code: result.kind === "refused" ? result.reason.code : null,
          });
          scheduleConversationMemoryRefresh(conversationId, session.userId);
          controller.close();
          return;
        }

        const { ready } = head;
        const userRow = await persistUserMessageOnly({
          conversationId,
          userText: parsed.data.text,
          classifiedTopics: ready.topicFields.classifiedTopics,
          topicConfidence: ready.topicFields.topicConfidence,
        });

        send("started", {
          messageId: userRow.id,
          classifier: {},
          ...(ready.modelRoutingActive && ready.routeDecision !== null
            ? {
                routing: {
                  modelId: ready.routeDecision.modelId,
                  reason: ready.routeDecision.reason,
                  policyVersion: ready.routeDecision.policyVersion,
                },
              }
            : {}),
        });

        let firstChunkAt: number | null = null;
        const genResult = await runStreamingGeneration(ready, deps, {
          signal: request.signal,
          onFirstCommittedByte: () => {
            if (firstChunkAt === null) {
              firstChunkAt = Date.now();
            }
          },
          onCommittedText: (text: string) => {
            send("chunk", { text });
          },
        });

        const streamFirstChunkMs = firstChunkAt !== null ? firstChunkAt - postReceiptMs : null;
        const streamTotalMs = Date.now() - postReceiptMs;

        console.info("rag.stream.complete", {
          ...logCtx,
          first_chunk_ms: streamFirstChunkMs,
          total_ms: streamTotalMs,
          kind: genResult.kind,
          refusal_code: genResult.kind === "refused" ? genResult.reason.code : null,
        });

        const assistantRow = await persistAssistantMessage({
          conversationId,
          result: genResult,
          streamFirstChunkMs,
          streamTotalMs,
        });

        await persistModelRoutingDecisionIfEnabled({
          assistantMessageId: assistantRow.id,
          result: genResult,
        });

        const userJson = {
          id: userRow.id,
          role: "user" as const,
          content: userRow.content,
          createdAt: userRow.createdAt.toISOString(),
        };
        const assistantJson = {
          id: assistantRow.id,
          role: "assistant" as const,
          content: assistantRow.content,
          citations: assistantRow.citations,
          refusal: assistantRow.refusal,
          createdAt: assistantRow.createdAt.toISOString(),
          rating: assistantRow.rating,
          ratingInvited: assistantRow.ratingInvited,
        };

        if (genResult.kind === "answered") {
          send("citations", { citations: genResult.citations });
          send("done", {
            tokensIn: genResult.usage.inputTokens,
            tokensOut: genResult.usage.outputTokens,
            latencyMs: genResult.operator.pipelineLatencyMs,
            user: userJson,
            assistant: assistantJson,
          });
        } else {
          send("refusal", {
            user: userJson,
            assistant: assistantJson,
          });
        }

        scheduleConversationMemoryRefresh(conversationId, session.userId);
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("rag.stream.error", { ...logCtx, message: msg });
        send("error", { message: "Something went wrong — please try again." });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
