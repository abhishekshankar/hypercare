import { createDbClient, safetyFlags } from "@alongside/db";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { scoreBurnout } from "@/lib/help/burnout-score";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  answers: z.array(z.number().int().min(0).max(4)).refine((a) => a.length === 7, {
    message: "Expected exactly 7 answers",
  }),
});

/**
 * Submits caregiver burnout self-check (TASK-021). When the score band is red or
 * red_severe, writes a soft (non-crisis-triage) row to `safety_flags` for
 * home-screen check-in elevation (TASK-024).
 */
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
  let scored: ReturnType<typeof scoreBurnout>;
  try {
    scored = scoreBurnout(parsed.data.answers);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scoring failed" },
      { status: 400 },
    );
  }

  if (scored.band === "red") {
    const db = createDbClient(serverEnv.DATABASE_URL);
    await db.insert(safetyFlags).values({
      userId: session.userId,
      messageText:
        "Burnout self-assessment (v0). Soft signal only; not a crisis-triage event. The numeric score is not kept long-term.",
      category: "self_care_burnout",
      severity: "low",
      source: "burnout_self_assessment",
      matchedSignals: [`total:${String(scored.score)}`, "band:red"],
    });
  } else if (scored.band === "red_severe") {
    const db = createDbClient(serverEnv.DATABASE_URL);
    await db.insert(safetyFlags).values({
      userId: session.userId,
      messageText:
        "Burnout self-assessment (v0). Soft signal only; not a crisis-triage event. The numeric score is not kept long-term.",
      category: "self_care_burnout",
      severity: "medium",
      source: "burnout_self_assessment",
      matchedSignals: [`total:${String(scored.score)}`, "band:red_severe"],
    });
  }

  return NextResponse.json({ ok: true, band: scored.band, score: scored.score });
}
