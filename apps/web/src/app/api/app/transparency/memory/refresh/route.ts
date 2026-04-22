import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { loadConversationOwned } from "@/lib/conversation/persist";
import { serverEnv } from "@/lib/env.server";
import { loadTransparencyMemoryPayload } from "@/lib/transparency/load-memory";
import {
  logTransparencyUserAction,
  TRANSPARENCY_REFRESH_ACTION,
} from "@/lib/transparency/user-actions";
import { countUserMessagesInConversation, invokeClaude, runConversationMemoryRefresh } from "@hypercare/rag";

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

  const n = await countUserMessagesInConversation(serverEnv.DATABASE_URL, parsed.data.conversationId);
  await runConversationMemoryRefresh({
    databaseUrl: serverEnv.DATABASE_URL,
    conversationId: parsed.data.conversationId,
    userId: session.userId,
    userMessageCount: n,
    generate: invokeClaude,
    forceRefresh: true,
    warn: (m: string, c?: Record<string, unknown>) => console.warn(m, c ?? {}),
  });

  await logTransparencyUserAction(serverEnv.DATABASE_URL, {
    userId: session.userId,
    action: TRANSPARENCY_REFRESH_ACTION,
    path: "/api/app/transparency/memory/refresh",
    meta: { conversationId: parsed.data.conversationId },
  });

  const bundle = await loadTransparencyMemoryPayload(
    serverEnv.DATABASE_URL,
    session.userId,
    parsed.data.conversationId,
  );

  return NextResponse.json({
    ok: true,
    summary: bundle?.summaryMd ?? null,
    sourceMessageCount: bundle?.sourceMessageCount ?? 0,
    refreshedAt: bundle?.refreshedAt ?? null,
    hasRenderableSummary: bundle?.hasRenderableSummary ?? false,
  });
}
