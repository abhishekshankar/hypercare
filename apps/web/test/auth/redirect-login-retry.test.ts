import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { OAUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { redirectToLoginRetry } from "@/lib/auth/redirect-login-retry";

describe("redirectToLoginRetry", () => {
  it("redirects to /api/auth/login with encoded next path", () => {
    const req = new NextRequest("http://127.0.0.1:3456/api/auth/callback");
    const res = redirectToLoginRetry(req, "/app/profile");
    expect(res.status).toBe(307);
    const loc = res.headers.get("location");
    expect(loc).toBeTruthy();
    const u = new URL(loc!);
    expect(u.pathname).toBe("/api/auth/login");
    expect(u.searchParams.get("next")).toBe("/app/profile");
  });

  it("rejects open redirects via safeNextPath (falls back to /app)", () => {
    const req = new NextRequest("http://127.0.0.1:3456/api/auth/callback");
    const res = redirectToLoginRetry(req, "//evil.example/phish");
    const loc = res.headers.get("location");
    expect(loc).toBeTruthy();
    const u = new URL(loc!);
    expect(u.pathname).toBe("/api/auth/login");
    expect(u.searchParams.get("next")).toBe("/app");
  });

  it("clears the OAuth PKCE cookie", () => {
    const req = new NextRequest("http://127.0.0.1:3456/api/auth/callback");
    const res = redirectToLoginRetry(req, "/app");
    const raw =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie().join("\n")
        : (res.headers.get("set-cookie") ?? "");
    expect(raw).toContain(`${OAUTH_COOKIE_NAME}=`);
    expect(raw).toContain("Max-Age=0");
  });
});
