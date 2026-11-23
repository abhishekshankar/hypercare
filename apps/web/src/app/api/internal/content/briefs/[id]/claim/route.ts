import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient, moduleBriefs, modules } from "@alongside/db";
import { hasAnyRole, type AppRole } from "@alongside/content";
import { serverEnv } from "@/lib/env.server";
import { requireInternalContentUser } from "@/lib/internal/content-access";
import { DEFAULT_CLAIMED_MODULE_BODY } from "@/lib/internal/claim-template";

function uniqueSlug(base: string): string {
  const kebab = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const s = (kebab || "module") + "-" + randomBytes(3).toString("hex");
  return s;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireInternalContentUser();
  if (!auth.ok) {
    return auth.response;
  }
  if (!hasAnyRole(auth.user.role as AppRole, ["content_writer", "content_lead", "admin"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id: briefId } = await context.params;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [br] = await db.select().from(moduleBriefs).where(eq(moduleBriefs.id, briefId)).limit(1);
  if (!br) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (br.status !== "open") {
    return NextResponse.json({ error: "brief is not open" }, { status: 409 });
  }
  const title = (br.proposedTitle != null && br.proposedTitle.length > 0 ? br.proposedTitle : br.topic) ?? "Untitled";
  const filtered = br.stageRelevance.filter((x): x is "early" | "middle" | "late" =>
    x === "early" || x === "middle" || x === "late",
  );
  const stageOk: ("early" | "middle" | "late")[] = filtered.length > 0 ? [...filtered] : ["early", "middle"];
  return await db.transaction(async (tx) => {
    const slug = uniqueSlug(title);
    const [mod] = await tx
      .insert(modules)
      .values({
        slug,
        title,
        category: "behaviors",
        stageRelevance: stageOk,
        tier: 2,
        summary: "Draft — edit in the content tool before review.",
        bodyMd: DEFAULT_CLAIMED_MODULE_BODY,
        attributionLine: "Attribution TBD at publish — replace before publication.",
        expertReviewer: null,
        tryThisToday: null,
        published: false,
        draftStatus: "draft",
        briefId: br.id,
      })
      .returning({ id: modules.id });
    if (!mod) {
      throw new Error("module insert");
    }
    await tx
      .update(moduleBriefs)
      .set({ status: "drafted", claimedBy: auth.user.id })
      .where(eq(moduleBriefs.id, briefId));
    return NextResponse.json({ moduleId: mod.id, slug });
  });
}
