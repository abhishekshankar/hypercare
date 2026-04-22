import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Returns the current opaque session, or 401.
 */
export async function GET() {
  const s = await getSession();
  if (s == null) {
    return new NextResponse(null, { status: 401 });
  }
  return NextResponse.json({
    userId: s.userId,
    cognitoSub: s.cognitoSub,
    email: s.email,
    expiresAt: s.expiresAt,
  });
}
