import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient, moduleEvidence, moduleStateTransitions, modules } from "@hypercare/db";
import { isDraftStatus, validateTransitionRequest, type AppRole } from "@hypercare/content";
import { serverEnv } from "@/lib/env.server";
import { requireInternalContentUser } from "@/lib/internal/content-access";
import { postTransitionBody } from "@/lib/internal/content-schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const auth = await requireInternalContentUser();
  if (!auth.ok) {
    return auth.response;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = postTransitionBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;
  if (b.to === "published") {
    return NextResponse.json({ error: "use POST .../publish for published state" }, { status: 400 });
  }
  const { id: moduleId } = await context.params;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [m] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
  if (!m) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!isDraftStatus(m.draftStatus)) {
    return NextResponse.json({ error: "invalid module state" }, { status: 500 });
  }
  const from = m.draftStatus;
  const to = b.to;
  const [evRow] = await db
    .select({ n: count() })
    .from(moduleEvidence)
    .where(eq(moduleEvidence.moduleId, moduleId));
  const evn = Number(evRow?.n ?? 0);
  const err = validateTransitionRequest({
    from,
    to,
    userRole: auth.user.role as AppRole,
    evidenceCount: evn,
    reason: b.reason ?? null,
  });
  if (err != null) {
    return NextResponse.json({ error: err }, { status: 400 });
  }
  await db.transaction(async (tx) => {
    if (to === "retired") {
      await tx
        .update(modules)
        .set({ draftStatus: "retired", published: false, updatedAt: new Date() })
        .where(eq(modules.id, moduleId));
    } else {
      await tx
        .update(modules)
        .set({ draftStatus: to, updatedAt: new Date() })
        .where(eq(modules.id, moduleId));
    }
    await tx.insert(moduleStateTransitions).values({
      moduleId,
      fromStatus: from,
      toStatus: to,
      byUserId: auth.user.id,
      reason: b.reason ?? null,
    });
  });
  return NextResponse.json({ ok: true });
}
