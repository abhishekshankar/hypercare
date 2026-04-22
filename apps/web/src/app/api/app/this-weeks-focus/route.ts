import { createDbClient } from "@hypercare/db";
import { pickThisWeeksFocus } from "@hypercare/picker";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { refineFocusSubtitle } from "@/lib/home/focus-subtitle";
import { loadProfileBundle } from "@/lib/onboarding/status";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (session == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  const result = await pickThisWeeksFocus(
    { userId: session.userId },
    { db, now: () => new Date() },
  );
  const { profile } = await loadProfileBundle(session.userId);
  const subtitle = refineFocusSubtitle(result, profile?.hardestThing ?? null);
  return NextResponse.json({ result, subtitle });
}
