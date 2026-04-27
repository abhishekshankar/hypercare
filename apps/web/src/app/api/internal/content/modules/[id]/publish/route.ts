import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient, moduleTopics, modules } from "@alongside/db";
import { hasAnyRole, publishModuleFromDatabase, type AppRole } from "@alongside/content";
import { contentPublishDatabaseUrl, serverEnv } from "@/lib/env.server";
import { requireInternalContentUser } from "@/lib/internal/content-access";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  const auth = await requireInternalContentUser();
  if (!auth.ok) {
    return auth.response;
  }
  if (!hasAnyRole(auth.user.role as AppRole, ["content_lead", "admin"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id: moduleId } = await context.params;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [m] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
  if (!m) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (m.draftStatus !== "approved") {
    return NextResponse.json({ error: "module must be approved before publish" }, { status: 409 });
  }
  const topics = await db
    .select({ slug: moduleTopics.topicSlug })
    .from(moduleTopics)
    .where(eq(moduleTopics.moduleId, moduleId));
  if (topics.length < 2) {
    return NextResponse.json({ error: "at least two topic tags are required to publish" }, { status: 400 });
  }
  try {
    const res = await publishModuleFromDatabase({
      databaseUrl: contentPublishDatabaseUrl(),
      moduleId,
      currentDraftStatus: "approved",
      appUserRole: auth.user.role,
      publishedBy: auth.user.id,
    });
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "publish failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
