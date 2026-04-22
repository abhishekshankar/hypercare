import { NextRequest, NextResponse } from "next/server";

import { OAUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { isProductionCookieSecure } from "@/lib/env.server";

/** After recoverable failures (e.g. DB upsert): clear PKCE cookie and restart the OAuth flow. */
export function redirectToLoginRetry(request: NextRequest, nextPath: string): NextResponse {
  const login = new URL("/api/auth/login", request.nextUrl.origin);
  login.searchParams.set("next", safeNextPath(nextPath, "/app"));
  const res = NextResponse.redirect(login.toString());
  res.cookies.set(OAUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProductionCookieSecure() ? true : false,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
