import type { NextRequest, NextResponse } from "next/server";

import { logRedirectDebug } from "./redirect-debug";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizePublicOrigin(origin: string): string {
  const url = new URL(origin);
  if (url.protocol === "http:" && url.hostname.endsWith(".cloudfront.net")) {
    url.protocol = "https:";
  }
  return url.origin;
}

/**
 * Origin to use when constructing in-app redirect URLs (e.g. → /api/auth/login,
 * → /auth/error, → /onboarding).
 *
 * Why this exists:
 *   In production behind CloudFront → ALB → Lambda, the `Host` header inside the
 *   Lambda is the ALB's internal DNS (CloudFront strips Host per its origin
 *   request policy). `request.nextUrl.origin` therefore resolves to the ALB
 *   hostname, and emitting redirects against it sends the browser to a URL it
 *   can't reach (the ALB returns 403 to anyone missing the X-Origin-Verify
 *   secret). Forwarding the original `Host` header through CloudFront would
 *   work but inflates the cache key and breaks the host-strip pattern that
 *   keeps S3/ALB origins clean — easier to anchor to the env var that's
 *   already the canonical public URL.
 *
 * Behavior:
 *   - Production / staging: returns `AUTH_BASE_URL` (post-deploy script pins
 *     this to the CloudFront URL).
 *   - Dev / Playwright / unit tests: falls back to `request.nextUrl.origin`
 *     so loopback ports keep working naturally.
 *
 * Edge-safe: only touches `process.env` and the request URL, no Node APIs.
 */
export function publicAppOrigin(request: NextRequest): string {
  const fromEnv = process.env.AUTH_BASE_URL?.trim();
  if (fromEnv != null && fromEnv.length > 0) {
    try {
      return normalizePublicOrigin(fromEnv);
    } catch {
      // malformed AUTH_BASE_URL — fall through rather than poison every redirect
    }
  }
  return normalizePublicOrigin(request.nextUrl.origin);
}

function normalizeHost(hostname: string): string {
  const h = hostname.toLowerCase();
  return h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
}

/**
 * If non-null, redirect the browser to this URL (same path/query, canonical loopback host).
 * Exported for unit tests.
 *
 * `requestUrl` provides path/query only — Next dev rewrites the URL hostname/port to its
 * configured canonical, so we must consult `hostHeader` to know the origin the browser is on
 * (and which the cookie will be scoped to).
 */
export function canonicalLoopbackRedirectUrl(
  requestUrl: string,
  authBaseUrl: string | undefined,
  nodeEnv: string | undefined,
  playwrightBaseUrl?: string | undefined,
  hostHeader?: string | null,
): string | null {
  if (nodeEnv !== "development") {
    return null;
  }
  // TASK-013: under Playwright (next dev forces NODE_ENV="development" in Edge
  // middleware regardless of the parent NODE_ENV), the canonical-origin bounce
  // can fight the test base URL and loop. Skip it when Playwright owns the run.
  // Belt-and-suspenders: never honor PLAYWRIGHT_TEST_BASE_URL if this function
  // is ever reachable in production (mis-set env would otherwise disable the
  // dev-only loopback redirect and could mask host/canonical issues).
  // `nodeEnv` is narrowed to "development" above; read `process.env.NODE_ENV` here so
  // the production belt is not a no-op to TypeScript and defense-in-depth stays if
  // the outer guard is ever refactored.
  // Read process.env directly (not the narrowed `nodeEnv` param) so TS cannot treat this
  // inner check as provably true/false and elide the production guard.
  if (
    playwrightBaseUrl != null &&
    playwrightBaseUrl.length > 0 &&
    process.env.NODE_ENV !== "production"
  ) {
    return null;
  }
  const baseRaw = authBaseUrl?.trim();
  if (baseRaw == null || baseRaw.length === 0) {
    return null;
  }
  let canonical: URL;
  try {
    canonical = new URL(baseRaw);
  } catch {
    return null;
  }
  let reqUrl: URL;
  try {
    reqUrl = new URL(requestUrl);
  } catch {
    return null;
  }
  // Next dev rewrites `request.url` to its canonical hostname even when the browser used a
  // different loopback name/port — trust the `Host` header for the comparison so we catch the
  // mismatch that scopes the PKCE cookie to the wrong origin.
  let currentHost = normalizeHost(reqUrl.hostname);
  let currentPort = reqUrl.port;
  if (hostHeader != null && hostHeader.length > 0) {
    try {
      const parsed = new URL(`http://${hostHeader}`);
      currentHost = normalizeHost(parsed.hostname);
      currentPort = parsed.port;
    } catch {
      // fall through to URL-derived values
    }
  }
  const canonicalHost = normalizeHost(canonical.hostname);
  if (!LOOPBACK.has(currentHost) || !LOOPBACK.has(canonicalHost)) {
    return null;
  }
  const canonicalPort = canonical.port;
  // Match Cognito callback origin exactly (scheme + host + port). Hostname-only checks miss
  // :3001 vs :3000 when another process holds the default port — PKCE cookie stays on the
  // wrong origin → callback sees no `hc_oauth` → invalid_state.
  if (currentHost === canonicalHost && currentPort === canonicalPort) {
    return null;
  }
  const target = new URL(reqUrl.toString());
  target.protocol = canonical.protocol;
  target.host = canonical.host;
  return target.toString();
}

/**
 * Cognito allows one exact callback origin locally (e.g. `http://localhost:3000/...`).
 * Visiting the wrong loopback host or port sets `hc_oauth` there while Cognito returns to
 * `AUTH_BASE_URL`, so the cookie is missing → `invalid_state`. In development only, bounce to
 * the exact origin from `AUTH_BASE_URL` (hostname and port).
 */
export function redirectToCanonicalAuthOrigin(request: NextRequest): NextResponse | null {
  const to = canonicalLoopbackRedirectUrl(
    request.url,
    process.env.AUTH_BASE_URL,
    process.env.NODE_ENV,
    process.env.PLAYWRIGHT_TEST_BASE_URL,
    request.headers.get("host"),
  );
  if (to == null) {
    return null;
  }
  logRedirectDebug("canonical_origin", { from: request.url, to });
  // Next dev rewrites `request.url` to its canonical hostname, so a 3xx Location to a different
  // browser-facing host (e.g. `127.0.0.1` vs `localhost`) collapses to a relative path that the
  // browser resolves against the wrong origin — the bounce never lands and `hc_oauth` stays on
  // the wrong host. Send a tiny HTML page that performs the navigation client-side; the browser
  // honors the absolute URL because it parses the response body, not Next's Location header.
  const escaped = to
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  const body = `<!doctype html><meta charset="utf-8"><title>Redirecting…</title><meta http-equiv="refresh" content="0;url=${escaped}"><script>window.location.replace(${JSON.stringify(to)});</script><a href="${escaped}">Continue</a>`;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  }) as unknown as NextResponse;
}
