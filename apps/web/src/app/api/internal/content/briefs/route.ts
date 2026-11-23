import { NextResponse } from "next/server";
import { moduleBriefs } from "@alongside/db";
import { hasAnyRole, type AppRole } from "@alongside/content";
import { createDbClient } from "@alongside/db";
import { serverEnv } from "@/lib/env.server";
import { requireInternalContentUser } from "@/lib/internal/content-access";
import { postBriefBody } from "@/lib/internal/content-schemas";

export async function POST(request: Request) {
  const auth = await requireInternalContentUser();
  if (!auth.ok) {
    return auth.response;
  }
  if (!hasAnyRole(auth.user.role as AppRole, ["content_lead", "admin"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = postBriefBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db
    .insert(moduleBriefs)
    .values({
      topic: b.topic,
      audience: b.audience,
      stageRelevance: b.stageRelevance.filter((x) => x !== "any"),
      desiredOutcome: b.desiredOutcome,
      proposedTitle: b.proposedTitle ?? null,
      queueReason: b.queueReason,
      createdBy: auth.user.id,
      status: "open",
    })
    .returning({ id: moduleBriefs.id });
  if (!row) {
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
  return NextResponse.json({ id: row.id });
}
