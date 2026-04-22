import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient, moduleTopics, modules } from "@hypercare/db";
import { hasAnyRole, type AppRole } from "@hypercare/content";
import { serverEnv } from "@/lib/env.server";
import { requireInternalContentUser } from "@/lib/internal/content-access";
import { patchModuleBody } from "@/lib/internal/content-schemas";

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
  const parsed = patchModuleBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;
  if (Object.keys(b).length === 0) {
    return NextResponse.json({ error: "empty patch" }, { status: 400 });
  }
  const { id: moduleId } = await context.params;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [m] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
  if (!m) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (m.draftStatus === "published" || m.draftStatus === "retired") {
    return NextResponse.json({ error: "read-only in this state" }, { status: 409 });
  }
  if (b.assignedExpertReviewerId !== undefined || b.assignedLivedReviewerId !== undefined) {
    if (!hasAnyRole(auth.user.role as AppRole, ["content_lead", "admin"])) {
      return NextResponse.json({ error: "forbidden: reviewer assignment" }, { status: 403 });
    }
  }
  await db.transaction(async (tx) => {
    const patch: Partial<typeof m> = { updatedAt: new Date() };
    if (b.title != null) {
      patch.title = b.title;
    }
    if (b.bodyMd != null) {
      patch.bodyMd = b.bodyMd;
    }
    if (b.summary != null) {
      patch.summary = b.summary;
    }
    if (b.tryThisToday !== undefined) {
      patch.tryThisToday = b.tryThisToday;
    }
    if (b.category != null) {
      patch.category = b.category;
    }
    if (b.tier != null) {
      patch.tier = b.tier;
    }
    if (b.stageRelevance != null) {
      patch.stageRelevance = b.stageRelevance;
    }
    if (b.attributionLine != null) {
      patch.attributionLine = b.attributionLine;
    }
    if (b.expertReviewer !== undefined) {
      patch.expertReviewer = b.expertReviewer;
    }
    if (b.assignedExpertReviewerId !== undefined) {
      patch.assignedExpertReviewerId = b.assignedExpertReviewerId;
    }
    if (b.assignedLivedReviewerId !== undefined) {
      patch.assignedLivedReviewerId = b.assignedLivedReviewerId;
    }
    await tx.update(modules).set(patch).where(eq(modules.id, moduleId));
    if (b.topicSlugs != null) {
      await tx.delete(moduleTopics).where(eq(moduleTopics.moduleId, moduleId));
      if (b.topicSlugs.length > 0) {
        await tx
          .insert(moduleTopics)
          .values(b.topicSlugs.map((topicSlug) => ({ moduleId, topicSlug })));
      }
    }
  });
  return NextResponse.json({ ok: true });
}
