import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { isInternalAdmin } from "@/lib/auth/internal-admin";

export const dynamic = "force-dynamic";

/** JSON probe for “admin vs caregiver” (403 vs 200). Pages use 404 to avoid surface enumeration. */
export async function GET() {
  const s = await getSession();
  if (s == null) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  if (!(await isInternalAdmin(s.userId, s.email))) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
