import "server-only";
import { eq } from "drizzle-orm";

import { createDbClient, users } from "@hypercare/db";

import { serverEnv } from "../env.server";

function allowlistEmails(): Set<string> {
  const raw = serverEnv.INTERNAL_METRICS_ALLOW_EMAILS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function isInternalAdmin(userId: string, email: string): Promise<boolean> {
  if (allowlistEmails().has(email.trim().toLowerCase())) {
    return true;
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.role === "admin";
}
