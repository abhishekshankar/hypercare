import { createDbClient, weeklyCheckins } from "@hypercare/db";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tried_something: z.boolean().nullable(),
  what_helped: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (session == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  const now = new Date();
  await db.insert(weeklyCheckins).values({
    userId: session.userId,
    promptedAt: now,
    answeredAt: now,
    triedSomething: parsed.data.tried_something,
    whatHelped: parsed.data.what_helped ?? null,
  });
  return NextResponse.json({ ok: true as const });
}
