import { eq } from "drizzle-orm";
import { careProfile, createDbClient, deleteUserAccount } from "@alongside/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { clearSessionOnResponse, getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
});

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
  if (parsed.data.email.trim().toLowerCase() !== session.email.trim().toLowerCase()) {
    return NextResponse.json({ error: "email_mismatch" }, { status: 400 });
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [profile] = await db
    .select({ crFirstName: careProfile.crFirstName })
    .from(careProfile)
    .where(eq(careProfile.userId, session.userId))
    .limit(1);
  try {
    await deleteUserAccount(db, {
      userId: session.userId,
      pii: { email: session.email, crFirstName: profile?.crFirstName ?? null },
      audit: {
        path: "/api/app/privacy/delete",
        source: "self_service",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "delete_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  const res = NextResponse.json(
    { ok: true, redirect: "/?deleted=1" },
    { status: 200 },
  );
  clearSessionOnResponse(res);
  return res;
}
