import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { loadTransparencyMemoryPayload } from "@/lib/transparency/load-memory";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cid = request.nextUrl.searchParams.get("conversationId");
  const p = await loadTransparencyMemoryPayload(serverEnv.DATABASE_URL, session.userId, cid);
  return NextResponse.json({
    conversationId: p.selectedConversationId,
    conversations: p.conversations,
    summary: p.summaryMd,
    sourceMessageCount: p.sourceMessageCount,
    refreshedAt: p.refreshedAt,
    invalidated: p.invalidated,
    hasRenderableSummary: p.hasRenderableSummary,
  });
}
