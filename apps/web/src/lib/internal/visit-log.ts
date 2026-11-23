import "server-only";
import { desc, eq } from "drizzle-orm";
import { adminAudit, createDbClient, userSessions } from "@alongside/db";
import { headers } from "next/headers";

import { serverEnv } from "../env.server";

const TEN_MIN_MS = 10 * 60 * 1000;

export async function logAdminAudit(userId: string, path: string): Promise<void> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  await db.insert(adminAudit).values({ userId, path });
}

/**
 * Cohort log for "opened `/app`" (TASK-029) — at most one row per 10 minutes per user.
 */
export async function maybeLogUserSessionForApp(userId: string): Promise<void> {
  const h = await headers();
  const full = h.get("x-hc-pathname") ?? "/app";
  const path = (full.split("?")[0] ?? "/app").trim() || "/app";
  if (!path.startsWith("/app")) {
    return;
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db
    .select({ last: userSessions.visitedAt })
    .from(userSessions)
    .where(eq(userSessions.userId, userId))
    .orderBy(desc(userSessions.visitedAt))
    .limit(1);
  const now = Date.now();
  if (row?.last != null && now - row.last.getTime() < TEN_MIN_MS) {
    return;
  }
  await db.insert(userSessions).values({ userId, path, visitedAt: new Date() });
}
