import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient, moduleEvidence, modules } from "@hypercare/db";
import { hasAnyRole, type AppRole } from "@hypercare/content";
import { serverEnv } from "@/lib/env.server";
import { requireInternalContentUser } from "@/lib/internal/content-access";
import { postEvidenceBody } from "@/lib/internal/content-schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const auth = await requireInternalContentUser();
  if (!auth.ok) {
    return auth.response;
  }
  if (!hasAnyRole(auth.user.role as AppRole, ["content_writer", "content_lead", "admin"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = postEvidenceBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;
  const { id: moduleId } = await context.params;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [m] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
  if (!m) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (m.draftStatus === "published" || m.draftStatus === "retired") {
    return NextResponse.json({ error: "read-only" }, { status: 409 });
  }
  const [row] = await db
    .insert(moduleEvidence)
    .values({
      moduleId,
      sourceTier: b.sourceTier,
      sourceType: b.sourceType,
      citation: b.citation,
      url: b.url ?? null,
      quotedSupport: b.quotedSupport ?? null,
      addedBy: auth.user.id,
    })
    .returning({ id: moduleEvidence.id });
  if (!row) {
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
  return NextResponse.json({ id: row.id });
}
