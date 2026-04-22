import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { createDbClient } from "@hypercare/db";

import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

/**
 * TASK-039: prune `safety_ft_shadow_decisions` older than 30 days (ADR 0021 alignment).
 * Wire EventBridge → POST with `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function POST(request: Request) {
  const secret = serverEnv.CRON_SECRET;
  if (secret == null) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 501 });
  }
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createDbClient(serverEnv.DATABASE_URL);
  await db.execute(sql`
    DELETE FROM safety_ft_shadow_decisions
    WHERE observed_at < now() - interval '30 days'
  `);
  return NextResponse.json({ ok: true });
}
