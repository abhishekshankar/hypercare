import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { loadThread } from "@/lib/conversation/load";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  if (!id || id.length < 8) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const thread = await loadThread(id, session.userId);
  if (!thread) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(thread);
}
