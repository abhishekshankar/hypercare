import { NextResponse } from "next/server";

import { loadFeedbackDetail } from "@/lib/feedback/load-detail";
import { requireInternalAdminApi } from "@/lib/internal/require-admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireInternalAdminApi();
  if (!auth.ok) {
    return auth.response;
  }
  const { id } = await context.params;
  const detail = await loadFeedbackDetail(id);
  if (detail == null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
