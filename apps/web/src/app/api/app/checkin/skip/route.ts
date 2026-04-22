import { createDbClient, weeklyCheckins } from "@hypercare/db";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (session == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  const now = new Date();
  await db.insert(weeklyCheckins).values({
    userId: session.userId,
    promptedAt: now,
    answeredAt: now,
    triedSomething: null,
    whatHelped: null,
  });
  return NextResponse.json({ ok: true as const });
}
