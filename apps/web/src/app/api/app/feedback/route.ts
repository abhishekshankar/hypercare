import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { conversations, createDbClient, messages, userFeedback } from "@alongside/db";

import { getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";

const bodySchema = z.object({
  kind: z.enum(["off_reply", "not_found", "suggestion", "other"]),
  body: z.string().max(2000),
  include_context: z.boolean().optional().default(false),
  message_id: z.string().uuid().optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (session == null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
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
  const b = parsed.data;
  const text = b.body.trim();
  if (text.length === 0) {
    return NextResponse.json({ error: "body_required" }, { status: 400 });
  }

  const db = createDbClient(serverEnv.DATABASE_URL);
  let conversationId: string | null = null;
  let messageId: string | null = null;

  if (b.include_context) {
    if (b.message_id) {
      const [m] = await db
        .select({ id: messages.id, conversationId: messages.conversationId, role: messages.role })
        .from(messages)
        .where(eq(messages.id, b.message_id))
        .limit(1);
      if (!m || m.role !== "assistant") {
        return NextResponse.json({ error: "message_not_found" }, { status: 400 });
      }
      const [c] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, m.conversationId), eq(conversations.userId, session.userId)))
        .limit(1);
      if (!c) {
        return NextResponse.json({ error: "message_not_found" }, { status: 400 });
      }
      conversationId = m.conversationId;
      messageId = m.id;
    } else {
      const [latestConv] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.userId, session.userId))
        .orderBy(desc(conversations.updatedAt))
        .limit(1);
      if (latestConv) {
        conversationId = latestConv.id;
        const [lastAsst] = await db
          .select({ id: messages.id })
          .from(messages)
          .where(and(eq(messages.conversationId, latestConv.id), eq(messages.role, "assistant")))
          .orderBy(desc(messages.createdAt))
          .limit(1);
        messageId = lastAsst?.id ?? null;
      }
    }
  }

  const [row] = await db
    .insert(userFeedback)
    .values({
      userId: session.userId,
      kind: b.kind,
      body: text,
      conversationId,
      messageId,
      includeContext: b.include_context,
    })
    .returning({ id: userFeedback.id });

  return NextResponse.json({ id: row!.id });
}
