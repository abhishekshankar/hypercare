import { and, count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { createDbClient, userFeedback } from "@alongside/db";

import { postSlackFeedbackMessage } from "@/lib/feedback/slack";
import { baseUrl, serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

/**
 * Nightly SLA check (TASK-036). Wire EventBridge → HTTP POST with `Authorization: Bearer ${CRON_SECRET}`.
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

  const [stale] = await db
    .select({ n: count() })
    .from(userFeedback)
    .where(
      and(eq(userFeedback.triageState, "new"), sql`${userFeedback.submittedAt} < now() - interval '72 hours'`),
    );

  const staleN = Number(stale?.n ?? 0);
  if (staleN > 10) {
    await postSlackFeedbackMessage(
      `${staleN} feedback item(s) still in "new" after 72h — ${baseUrl()}/internal/feedback`,
    );
  }

  const [hp] = await db
    .select({ n: count() })
    .from(userFeedback)
    .where(
      and(
        eq(userFeedback.triageState, "new"),
        eq(userFeedback.triagePriority, "high"),
        sql`${userFeedback.submittedAt} < now() - interval '24 hours'`,
      ),
    );

  const hpN = Number(hp?.n ?? 0);
  if (hpN > 0) {
    await postSlackFeedbackMessage(
      `URGENT: ${hpN} high-priority feedback item(s) in "new" over 24h — ${baseUrl()}/internal/feedback`,
    );
  }

  return NextResponse.json({ ok: true, stale_new_over_72h: staleN, high_priority_stale_24h: hpN });
}
