import { createDbClient, careProfile } from "@hypercare/db";
import { pickThisWeeksFocus } from "@hypercare/picker";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { refineFocusSubtitle } from "@/lib/home/focus-subtitle";
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
  const [cp] = await db
    .select({ hardestThing: careProfile.hardestThing })
    .from(careProfile)
    .where(eq(careProfile.userId, session.userId))
    .limit(1);
  const subtitle = refineFocusSubtitle(result, cp?.hardestThing ?? null);
  return NextResponse.json({ result, subtitle });
}
