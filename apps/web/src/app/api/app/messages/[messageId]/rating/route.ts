import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { conversations, createDbClient, messages, userFeedback } from "@hypercare/db";

import { getSession } from "@/lib/auth/session";
import { baseUrl } from "@/lib/env.server";
import { postSlackFeedbackMessage } from "@/lib/feedback/slack";
import { recordThumbsDownFeedback } from "@/lib/feedback/thumbs-down-queue";
import { serverEnv } from "@/lib/env.server";

const bodySchema = z.object({
  rating: z.enum(["up", "down"]),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ messageId: string }> },
) {
  const session = await getSession();
  if (session == null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { messageId } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db
    .select({
      role: messages.role,
      convUser: conversations.userId,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!row || row.convUser !== session.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (row.role !== "assistant") {
    return NextResponse.json({ error: "not_ratable" }, { status: 400 });
  }

  const now = new Date();
  await db
    .update(messages)
    .set({ rating: parsed.data.rating, ratedAt: now })
    .where(eq(messages.id, messageId));

  if (parsed.data.rating === "down") {
    const out = await recordThumbsDownFeedback({
      databaseUrl: serverEnv.DATABASE_URL,
      userId: session.userId,
      messageId,
    });
    if (out.inserted && out.feedbackId) {
      const [pr] = await db
        .select({ triagePriority: userFeedback.triagePriority })
        .from(userFeedback)
        .where(eq(userFeedback.id, out.feedbackId))
        .limit(1);
      if (pr?.triagePriority === "high") {
        await postSlackFeedbackMessage(
          `High-priority thumbs-down (escalation turn). Open queue: ${baseUrl()}/internal/feedback (id: ${out.feedbackId})`,
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
