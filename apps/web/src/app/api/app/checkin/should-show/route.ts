import { createDbClient } from "@alongside/db";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { shouldShowWeeklyCheckin } from "@/lib/home/checkin-cadence";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (session == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  const { show, reason } = await shouldShowWeeklyCheckin(session.userId, { db, now: () => new Date() });
  return NextResponse.json({ show, reason });
}
