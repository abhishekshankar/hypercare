import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { createDbClient, users } from "@hypercare/db";
import { hasAnyRole, type AppRole } from "@hypercare/content";
import { serverEnv } from "@/lib/env.server";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

/** Anyone except plain `caregiver` may use `/internal/content` in v0. */
const INTERNAL_CONTENT_ACCESS: readonly AppRole[] = [
  "content_writer",
  "content_lead",
  "medical_director",
  "care_specialist",
  "caregiver_support_clinician",
  "lived_experience_reviewer",
  "admin",
];

export type AuthedUserRow = InferSelectModel<typeof users>;

/**
 * @returns 401/403 as JSON `NextResponse`, or `{ session, user }`
 */
export async function requireInternalContentUser(): Promise<
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>>; user: AuthedUserRow }
  | { ok: false; response: NextResponse }
> {
  const s = await getSession();
  if (s == null) {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [u] = await db.select().from(users).where(eq(users.id, s.userId)).limit(1);
  if (!u) {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!hasAnyRole(u.role as AppRole, INTERNAL_CONTENT_ACCESS)) {
    return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, session: s, user: u };
}

export { INTERNAL_CONTENT_ACCESS };

/**
 * @deprecated use requireInternalContentUser — kept for page layouts that only need a soft check
 */
export async function getSessionWithRole() {
  const r = await requireInternalContentUser();
  if (!r.ok) {
    return null;
  }
  return { session: r.session, user: r.user, role: r.user.role as AppRole };
}
