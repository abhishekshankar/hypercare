import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { getSuppressionStatus } from "@/lib/safety/user-suppression";

export const dynamic = "force-dynamic";

/**
 * `GET /api/app/suppression/status` — JSON for clients/tests; the home page uses
 * `getSuppressionStatus` directly during SSR (TASK-025).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const s = await getSuppressionStatus(session.userId);
  if (!s.active) {
    return NextResponse.json({ active: false } as const);
  }
  return NextResponse.json({
    active: true,
    until: s.until,
    reason: s.reason,
  } as const);
}
