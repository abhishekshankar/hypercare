import { NextRequest, NextResponse } from "next/server";

import { redirectToCanonicalAuthOrigin } from "@/lib/auth/canonical-origin";
import { isSessionCookieValid, SESSION_COOKIE_NAME } from "@/lib/auth/middleware-edge";

const SESSION_SECRET = process.env.SESSION_COOKIE_SECRET;

export const config = {
  matcher: [
    /*
     * Broad enough to normalize localhost vs 127.0.0.1 before OAuth cookies are set; still skip static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export async function middleware(request: NextRequest) {
  const bounce = redirectToCanonicalAuthOrigin(request);
  if (bounce != null) {
    return bounce;
  }

  const pathname = request.nextUrl.pathname;
  const fullPath = pathname + request.nextUrl.search;

  const needsSessionGate =
    pathname.startsWith("/app") ||
    pathname.startsWith("/api/app") ||
    pathname.startsWith("/api/internal") ||
    pathname.startsWith("/internal") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/");

  if (!needsSessionGate) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-hc-pathname", fullPath);

  // Machine clients expect JSON 401 from Route Handlers, not a 302 to the login page.
  if (pathname.startsWith("/api/app") || pathname.startsWith("/api/internal")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (SESSION_SECRET == null || SESSION_SECRET.length === 0) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const ok = await isSessionCookieValid(raw, SESSION_SECRET);
  if (ok) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  const login = new URL("/api/auth/login", request.nextUrl.origin);
  login.searchParams.set("next", fullPath);
  return NextResponse.redirect(login);
}
