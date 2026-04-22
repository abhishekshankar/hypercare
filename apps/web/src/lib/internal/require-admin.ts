import "server-only";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { isInternalAdmin } from "@/lib/auth/internal-admin";

export type AdminAuth =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse };

export async function requireInternalAdminApi(): Promise<AdminAuth> {
  const s = await getSession();
  if (s == null) {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!(await isInternalAdmin(s.userId, s.email))) {
    return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, userId: s.userId, email: s.email };
}
