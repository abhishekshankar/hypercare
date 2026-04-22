import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { answerForUser } from "@/lib/conversation/answer-client";
import { loadConversationOwned, persistTurn } from "@/lib/conversation/persist";

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

  const result = await answerForUser({
    question: parsed.data.text,
    userId: session.userId,
  });

  const turn = await persistTurn({
    conversationId,
    userText: parsed.data.text,
    result,
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
