import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { loadCitedModulesForUser } from "@/lib/transparency/cited-modules";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const daysRaw = request.nextUrl.searchParams.get("days");
  const days = daysRaw == null ? 30 : Math.min(90, Math.max(1, Number.parseInt(daysRaw, 10) || 30));
  const modules = await loadCitedModulesForUser(serverEnv.DATABASE_URL, session.userId, days);
  return NextResponse.json({ days, modules });
}
