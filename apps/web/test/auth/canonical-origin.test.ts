import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalLoopbackRedirectUrl, publicAppOrigin } from "@/lib/auth/canonical-origin";

function fakeRequest(url: string): NextRequest {
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

describe("canonicalLoopbackRedirectUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when origin already matches AUTH_BASE_URL", () => {
    expect(
      canonicalLoopbackRedirectUrl(
        "http://localhost:3000/app",
        "http://localhost:3000",
        "development",
      ),
    ).toBeNull();
  });

  it("redirects same hostname to AUTH_BASE_URL port (Next dev alternate port)", () => {
    expect(
      canonicalLoopbackRedirectUrl(
        "http://localhost:3001/api/auth/login?next=%2Fapp",
        "http://localhost:3000",
        "development",
      ),
    ).toBe("http://localhost:3000/api/auth/login?next=%2Fapp");
  });

  it("redirects 127.0.0.1 to localhost from AUTH_BASE_URL", () => {
    expect(
      canonicalLoopbackRedirectUrl(
        "http://127.0.0.1:3000/app?x=1",
        "http://localhost:3000",
        "development",
      ),
    ).toBe("http://localhost:3000/app?x=1");
  });

  it("redirects localhost to 127.0.0.1 when AUTH_BASE_URL uses 127.0.0.1", () => {
    expect(
      canonicalLoopbackRedirectUrl(
        "http://localhost:3000/onboarding",
        "http://127.0.0.1:3000",
        "development",
      ),
    ).toBe("http://127.0.0.1:3000/onboarding");
  });

  it("does not run in production", () => {
    expect(
      canonicalLoopbackRedirectUrl(
        "http://127.0.0.1:3000/app",
        "http://localhost:3000",
        "production",
      ),
    ).toBeNull();
  });

  it("does not rewrite non-loopback hosts", () => {
    expect(
      canonicalLoopbackRedirectUrl(
        "https://evil.test/app",
        "http://localhost:3000",
        "development",
      ),
    ).toBeNull();
  });

  it("no-ops when PLAYWRIGHT_TEST_BASE_URL is set (TASK-013)", () => {
    expect(
      canonicalLoopbackRedirectUrl(
        "http://127.0.0.1:3456/app",
        "http://localhost:3000",
        "development",
        "http://127.0.0.1:3456",
      ),
    ).toBeNull();
  });

  it("ignores PLAYWRIGHT_TEST_BASE_URL in production (belt-and-suspenders)", () => {
    expect(
      canonicalLoopbackRedirectUrl(
        "http://127.0.0.1:3456/app",
        "http://localhost:3000",
        "production",
        "http://127.0.0.1:3456",
      ),
    ).toBeNull();
  });

  it("does not Playwright no-op when process NODE_ENV is production even if nodeEnv arg is wrong", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      canonicalLoopbackRedirectUrl(
        "http://127.0.0.1:3456/app?x=1",
        "http://localhost:3000",
        "development",
        "http://127.0.0.1:3456",
      ),
    ).toBe("http://localhost:3000/app?x=1");
  });

  it("uses Host header to detect mismatch when Next dev rewrites request.url", () => {
    // Next dev replaces `request.url` hostname with its canonical even when the browser used
    // a different loopback name. Trust the Host header — that's the origin scoping the cookie.
    expect(
      canonicalLoopbackRedirectUrl(
        "http://localhost:3000/api/auth/login?next=%2Fapp",
        "http://localhost:3000",
        "development",
        undefined,
        "127.0.0.1:3000",
      ),
    ).toBe("http://localhost:3000/api/auth/login?next=%2Fapp");
  });

  it("returns null when Host header matches AUTH_BASE_URL origin", () => {
    expect(
      canonicalLoopbackRedirectUrl(
        "http://localhost:3000/app",
        "http://localhost:3000",
        "development",
        undefined,
        "localhost:3000",
      ),
    ).toBeNull();
  });
});

describe("publicAppOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns AUTH_BASE_URL origin when set (production CloudFront case)", () => {
    // Behind CloudFront → ALB → Lambda, request.url's host is the ALB internal DNS,
    // so without this helper, in-app redirects would send users to the ALB → 403.
    vi.stubEnv("AUTH_BASE_URL", "https://d3o5s11j7mm79v.cloudfront.net");
    const req = fakeRequest("http://hyperc-alb16-internal.elb.amazonaws.com/onboarding");
    expect(publicAppOrigin(req)).toBe("https://d3o5s11j7mm79v.cloudfront.net");
  });

  it("strips path/query from AUTH_BASE_URL", () => {
    vi.stubEnv("AUTH_BASE_URL", "https://app.example.com/care1/?x=1");
    const req = fakeRequest("http://internal.local/anything");
    expect(publicAppOrigin(req)).toBe("https://app.example.com");
  });

  it("falls back to request origin when AUTH_BASE_URL is unset", () => {
    vi.stubEnv("AUTH_BASE_URL", "");
    const req = fakeRequest("http://localhost:3001/app");
    expect(publicAppOrigin(req)).toBe("http://localhost:3001");
  });

  it("falls back to request origin when AUTH_BASE_URL is malformed", () => {
    vi.stubEnv("AUTH_BASE_URL", "not-a-url");
    const req = fakeRequest("http://localhost:3000/app");
    expect(publicAppOrigin(req)).toBe("http://localhost:3000");
  });
});
