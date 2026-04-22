import { z } from "zod";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { completeLessonProgress } from "@/lib/lesson/persist";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  progressId: z.string().uuid(),
  revisit: z.boolean(),
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
  const r = await completeLessonProgress({
    userId: session.userId,
    progressId: parsed.data.progressId,
    revisit: parsed.data.revisit,
  });
  if (r.status === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ("revisitAck" in r && r.revisitAck != null) {
    return NextResponse.json({ ok: true as const, revisitAck: r.revisitAck });
  }
  return NextResponse.json({ ok: true as const });
}
