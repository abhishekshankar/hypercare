import { and, eq } from "drizzle-orm";
import {
  createDbClient,
  sessionRevocations,
  userAuthSessions,
} from "@hypercare/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { logAdminAudit } from "@/lib/internal/visit-log";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ sessionId: z.string().min(8) });

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (session == null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { sessionId } = parsed.data;
  if (sessionId === session.sessionId) {
    return NextResponse.json({ error: "use_logout" }, { status: 400 });
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db
    .select()
    .from(userAuthSessions)
    .where(
      and(
        eq(userAuthSessions.sessionId, sessionId),
        eq(userAuthSessions.userId, session.userId),
      ),
    )
    .limit(1);
  if (row == null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await db.insert(sessionRevocations).values({
    sessionId,
    userId: session.userId,
    reason: "admin_revoke",
  });
  await db.delete(userAuthSessions).where(eq(userAuthSessions.sessionId, sessionId));
  await logAdminAudit(session.userId, "/api/app/privacy/sessions/revoke");
  return NextResponse.json({ ok: true });
}
