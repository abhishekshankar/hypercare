import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeHost(hostname: string): string {
  const h = hostname.toLowerCase();
  return h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
}

/**
 * If non-null, redirect the browser to this URL (same path/query, canonical loopback host).
 * Exported for unit tests.
 */
export function canonicalLoopbackRedirectUrl(
  requestUrl: string,
  authBaseUrl: string | undefined,
  nodeEnv: string | undefined,
  playwrightBaseUrl?: string | undefined,
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
  const canonicalHost = normalizeHost(canonical.hostname);
  const currentHost = normalizeHost(reqUrl.hostname);
  if (currentHost === canonicalHost) {
    return null;
  }
  if (!LOOPBACK.has(currentHost) || !LOOPBACK.has(canonicalHost)) {
    return null;
  }
  const target = new URL(reqUrl.toString());
  target.protocol = canonical.protocol;
  target.host = canonical.host;
  return target.toString();
}

/**
 * Cognito allows one exact callback origin locally (e.g. `http://localhost:3000/...`).
 * Visiting `127.0.0.1` sets `hc_oauth` on that host while Cognito returns to `localhost`, so the cookie is missing → `invalid_state`.
 * In development only, bounce between loopback hostnames to match `AUTH_BASE_URL`.
 */
export function redirectToCanonicalAuthOrigin(request: NextRequest): NextResponse | null {
  const to = canonicalLoopbackRedirectUrl(
    request.url,
    process.env.AUTH_BASE_URL,
    process.env.NODE_ENV,
    process.env.PLAYWRIGHT_TEST_BASE_URL,
  );
  if (to == null) {
    return null;
  }
  return NextResponse.redirect(to, 307);
}
