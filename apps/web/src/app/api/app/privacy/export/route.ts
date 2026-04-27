import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { createDbClient, privacyExportRequests } from "@alongside/db";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (session == null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (serverEnv.PRIVACY_EXPORT_S3_BUCKET == null) {
    return NextResponse.json({ error: "export_unavailable" }, { status: 503 });
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [last] = await db
    .select()
    .from(privacyExportRequests)
    .where(eq(privacyExportRequests.userId, session.userId))
    .orderBy(desc(privacyExportRequests.createdAt))
    .limit(1);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (
    last != null &&
    last.status === "complete" &&
    last.createdAt != null &&
    last.createdAt > dayAgo
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (last != null && last.status === "pending") {
    return NextResponse.json({ exportId: last.id });
  }
  const id = randomUUID();
  await db.insert(privacyExportRequests).values({
    id,
    userId: session.userId,
    status: "pending",
  });
  return NextResponse.json({ exportId: id });
}
