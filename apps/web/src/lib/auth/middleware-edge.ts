import { verifyPayload } from "./cookie";
import { SESSION_COOKIE_NAME } from "./constants";
import type { SessionPayload } from "./types";

/**
 * Used by Next middleware (Edge). Verifies the signed cookie + expiry only — no ID token (see ADR-0004).
 */
export async function isSessionCookieValid(
  raw: string | undefined,
  sessionSecret: string,
): Promise<boolean> {
  if (raw == null || sessionSecret.length === 0) {
    return false;
  }
  const p = await verifyPayload<SessionPayload>(sessionSecret, raw);
  if (p == null) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof p.exp === "number" && p.exp < now) {
    return false;
  }
  if (
    typeof p.userId !== "string" ||
    typeof p.cognitoSub !== "string" ||
    typeof p.email !== "string"
  ) {
    return false;
  }
  return true;
}

export { SESSION_COOKIE_NAME };
