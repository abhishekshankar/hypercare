import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { loadRecentProfileChanges } from "@/lib/profile/load-recent-changes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = limitRaw == null ? 5 : Math.min(50, Math.max(1, Number.parseInt(limitRaw, 10) || 5));
  const rows = await loadRecentProfileChanges(session.userId, limit);
  return NextResponse.json({ items: rows });
}
