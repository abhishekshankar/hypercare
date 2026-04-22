import { z } from "zod";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { parseLessonSource, startLessonProgress } from "@/lib/lesson/persist";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  source: z.enum(["weekly_focus", "library_browse", "search", "conversation_link"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await getSession();
  if (session == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await context.params;
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
  const r = await startLessonProgress({
    userId: session.userId,
    moduleSlug: slug,
    source: parseLessonSource(parsed.data.source),
  });
  if (r === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ progressId: r.progressId });
}
