import "server-only";
import type { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { isProductionCookieSecure, serverEnv } from "../env.server";
import { signPayload, verifyPayload } from "./cookie";
import { DEFAULT_SESSION_TTL_SEC, SESSION_COOKIE_NAME } from "./constants";
import type { SessionPayload } from "./types";

export type Session = {
  userId: string;
  cognitoSub: string;
  email: string;
  /** Unix seconds (session expiry from cookie payload) */
  expiresAt: number;
};

function payloadToSession(p: SessionPayload): Session {
  return {
    userId: p.userId,
    cognitoSub: p.cognitoSub,
    email: p.email,
    expiresAt: p.exp,
  };
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  const p = await verifyPayload<SessionPayload>(serverEnv.SESSION_COOKIE_SECRET, raw);
  if (p == null) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (p.exp < now) {
    return null;
  }
  return payloadToSession(p);
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (s != null) {
    return s;
  }
  const h = await headers();
  const next = h.get("x-hc-pathname") ?? "/app";
  redirect(`/api/auth/login?next=${encodeURIComponent(next)}`);
}

const sessionCookieBase = () =>
  ({
    httpOnly: true,
    secure: isProductionCookieSecure() ? true : false,
    sameSite: "lax" as const,
    path: "/",
  }) as const;

export async function setSession(
  data: Omit<Session, "expiresAt">,
  options?: { maxAgeSeconds?: number },
): Promise<void> {
  const maxAgeSeconds = options?.maxAgeSeconds ?? DEFAULT_SESSION_TTL_SEC;
  const value = await buildSessionCookieValue(data, { maxAgeSeconds });
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, value, {
    ...sessionCookieBase(),
    maxAge: maxAgeSeconds,
  });
}

export async function buildSessionCookieValue(
  data: Omit<Session, "expiresAt">,
  options?: { maxAgeSeconds?: number },
): Promise<string> {
  const maxAgeSeconds = options?.maxAgeSeconds ?? DEFAULT_SESSION_TTL_SEC;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + maxAgeSeconds;
  const payload: SessionPayload = {
    userId: data.userId,
    cognitoSub: data.cognitoSub,
    email: data.email,
    iat: now,
    exp,
  };
  return signPayload(serverEnv.SESSION_COOKIE_SECRET, payload);
}

/**
 * Set `hc_session` on an explicit `NextResponse` (e.g. OAuth callback redirect).
 */
export async function applySessionToResponse(
  res: NextResponse,
  data: Omit<Session, "expiresAt">,
  options?: { maxAgeSeconds?: number },
): Promise<void> {
  const maxAgeSeconds = options?.maxAgeSeconds ?? DEFAULT_SESSION_TTL_SEC;
  const value = await buildSessionCookieValue(data, { maxAgeSeconds });
  res.cookies.set(SESSION_COOKIE_NAME, value, {
    ...sessionCookieBase(),
    maxAge: maxAgeSeconds,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieBase(),
    maxAge: 0,
  });
}

export function clearSessionOnResponse(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieBase(),
    maxAge: 0,
  });
}
