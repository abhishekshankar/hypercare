import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { loadConversationOwned } from "@/lib/conversation/persist";
import { serverEnv } from "@/lib/env.server";
import {
  logTransparencyUserAction,
  TRANSPARENCY_CLEAR_ACTION,
} from "@/lib/transparency/user-actions";
import { conversationMemory, conversationMemoryForgotten, createDbClient } from "@alongside/db";

export const dynamic = "force-dynamic";

const Body = z.object({
  conversationId: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.flatten() }, { status: 400 });
  }
  const owned = await loadConversationOwned(parsed.data.conversationId, session.userId);
  if (!owned) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const db = createDbClient(serverEnv.DATABASE_URL);
  await db
    .delete(conversationMemoryForgotten)
    .where(
      and(
        eq(conversationMemoryForgotten.conversationId, parsed.data.conversationId),
        eq(conversationMemoryForgotten.userId, session.userId),
      ),
    );

  const [existing] = await db
    .select({ refreshCount: conversationMemory.refreshCount })
    .from(conversationMemory)
    .where(
      and(
        eq(conversationMemory.conversationId, parsed.data.conversationId),
        eq(conversationMemory.userId, session.userId),
      ),
    )
    .limit(1);

  const refreshCount = existing?.refreshCount ?? 0;

  await db
    .insert(conversationMemory)
    .values({
      conversationId: parsed.data.conversationId,
      userId: session.userId,
      summaryMd: "",
      summaryTokens: 0,
      lastRefreshedAt: new Date(),
      refreshCount,
      invalidated: true,
      sourceMessageIds: [],
    })
    .onConflictDoUpdate({
      target: conversationMemory.conversationId,
      set: {
        summaryMd: "",
        summaryTokens: 0,
        lastRefreshedAt: new Date(),
        refreshCount,
        invalidated: true,
        sourceMessageIds: [],
        userId: session.userId,
      },
    });

  await logTransparencyUserAction(serverEnv.DATABASE_URL, {
    userId: session.userId,
    action: TRANSPARENCY_CLEAR_ACTION,
    path: "/api/app/transparency/memory/clear",
    meta: { conversationId: parsed.data.conversationId },
  });

  return NextResponse.json({ ok: true });
}
