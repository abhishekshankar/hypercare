import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient, moduleReviews, modules } from "@alongside/db";
import { hasAnyRole, type AppRole } from "@alongside/content";
import { serverEnv } from "@/lib/env.server";
import { requireInternalContentUser } from "@/lib/internal/content-access";
import { postReviewBody } from "@/lib/internal/content-schemas";
import { reviewRoleForSubmit } from "@/lib/internal/review-role";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const auth = await requireInternalContentUser();
  if (!auth.ok) {
    return auth.response;
  }
  if (!hasAnyRole(auth.user.role as AppRole, ["content_lead", "admin", "medical_director", "care_specialist", "lived_experience_reviewer", "caregiver_support_clinician"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = postReviewBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;
  const { id: moduleId } = await context.params;
  const rr = reviewRoleForSubmit({
    appRole: auth.user.role as AppRole,
    explicit: b.reviewRole,
  });
  if (!rr.ok) {
    return NextResponse.json({ error: rr.error }, { status: 403 });
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [m] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
  if (!m) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const [row] = await db
    .insert(moduleReviews)
    .values({
      moduleId,
      reviewerUserId: auth.user.id,
      reviewRole: rr.reviewRole,
      verdict: b.verdict,
      commentsMd: b.commentsMd ?? null,
    })
    .returning({ id: moduleReviews.id });
  if (!row) {
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
  return NextResponse.json({ id: row.id });
}
