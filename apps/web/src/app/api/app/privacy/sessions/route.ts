import { desc, eq } from "drizzle-orm";
import { createDbClient, userAuthSessions } from "@hypercare/db";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (session == null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  const rows = await db
    .select({
      sessionId: userAuthSessions.sessionId,
      lastSeenAt: userAuthSessions.lastSeenAt,
      countryCode: userAuthSessions.countryCode,
      createdAt: userAuthSessions.createdAt,
    })
    .from(userAuthSessions)
    .where(eq(userAuthSessions.userId, session.userId))
    .orderBy(desc(userAuthSessions.lastSeenAt));
  return NextResponse.json({
    sessions: rows.map((r) => ({
      ...r,
      current: r.sessionId === session.sessionId,
    })),
  });
}
