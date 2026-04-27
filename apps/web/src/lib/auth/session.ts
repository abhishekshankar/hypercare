import "server-only";
import { randomUUID } from "node:crypto";
import type { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { createDbClient, sessionRevocations, userAuthSessions } from "@alongside/db";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";

import { isProductionCookieSecure, serverEnv } from "../env.server";
import { signPayload, verifyPayload } from "./cookie";
import {
  SESSION_ABSOLUTE_MAX_SEC,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TTL_SEC,
} from "./constants";
import type { SessionPayload } from "./types";

export type Session = {
  userId: string;
  cognitoSub: string;
  email: string;
  /** Unix seconds (session expiry from cookie payload) */
  expiresAt: number;
  sessionId: string;
};

function sessionExpSec(iatSec: number, nowSec: number): number {
  return Math.min(iatSec + SESSION_ABSOLUTE_MAX_SEC, nowSec + SESSION_IDLE_TTL_SEC);
}

/**
 * If DB-backed revocation / touch fails, still return a session for HMAC+exp (matches middleware
 * and avoids login ↔ OAuth redirect loops when Postgres or migration 0012 is unavailable).
 */
function sessionFromPayload(p: SessionPayload, now: number): Session | null {
  if (p.sid == null || p.sid.length === 0) {
    return null;
  }
  const newExp = sessionExpSec(p.iat, now);
  return {
    userId: p.userId,
    cognitoSub: p.cognitoSub,
    email: p.email,
    expiresAt: Math.max(p.exp, newExp),
    sessionId: p.sid,
  };
}

export const getSession = cache(async (): Promise<Session | null> => {
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

  if (p.sid == null || p.sid.length === 0) {
    return await upgradeCookieWithSid(p, now);
  }

  try {
    const db = createDbClient(serverEnv.DATABASE_URL);
    const [rev] = await db
      .select({ sessionId: sessionRevocations.sessionId })
      .from(sessionRevocations)
      .where(eq(sessionRevocations.sessionId, p.sid))
      .limit(1);
    if (rev != null) {
      return null;
    }

    const newExp = sessionExpSec(p.iat, now);
    if (newExp > p.exp) {
      const value = await buildSessionCookieValue(
        { userId: p.userId, cognitoSub: p.cognitoSub, email: p.email },
        { iatSec: p.iat, sid: p.sid, maxAgeSeconds: newExp - p.iat },
      );
      const nextStore = await cookies();
      nextStore.set(SESSION_COOKIE_NAME, value, {
        ...sessionCookieBase(),
        maxAge: newExp - now,
      });
    }

    await db
      .update(userAuthSessions)
      .set({ lastSeenAt: new Date() })
      .where(and(eq(userAuthSessions.sessionId, p.sid), eq(userAuthSessions.userId, p.userId)));

    return {
      userId: p.userId,
      cognitoSub: p.cognitoSub,
      email: p.email,
      expiresAt: Math.max(p.exp, newExp),
      sessionId: p.sid,
    };
  } catch {
    return sessionFromPayload(p, now);
  }
});

async function upgradeCookieWithSid(p: SessionPayload, now: number): Promise<Session | null> {
  const sid = randomUUID();
  const newExp = sessionExpSec(p.iat, now);
  try {
    const db = createDbClient(serverEnv.DATABASE_URL);
    const h = await headers();
    const country = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry");
    try {
      await db.insert(userAuthSessions).values({
        sessionId: sid,
        userId: p.userId,
        countryCode: country,
      });
    } catch {
      /* duplicate sid or table missing — still set cookie below */
    }
  } catch {
    /* DB unreachable */
  }
  try {
    const value = await buildSessionCookieValue(
      { userId: p.userId, cognitoSub: p.cognitoSub, email: p.email },
      { iatSec: p.iat, sid, maxAgeSeconds: newExp - p.iat },
    );
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, value, {
      ...sessionCookieBase(),
      maxAge: newExp - now,
    });
  } catch {
    return null;
  }
  return {
    userId: p.userId,
    cognitoSub: p.cognitoSub,
    email: p.email,
    expiresAt: newExp,
    sessionId: sid,
  };
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

export type SetSessionOptions = {
  iatSec?: number;
  sid?: string;
  maxAgeSeconds?: number;
};

export async function buildSessionCookieValue(
  data: Omit<Session, "expiresAt" | "sessionId">,
  options?: SetSessionOptions,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const iat = options?.iatSec ?? now;
  const sid = options?.sid ?? randomUUID();
  const exp =
    options?.maxAgeSeconds != null ? iat + options.maxAgeSeconds : sessionExpSec(iat, now);
  const payload: SessionPayload = {
    userId: data.userId,
    cognitoSub: data.cognitoSub,
    email: data.email,
    iat,
    exp,
    sid,
  };
  return signPayload(serverEnv.SESSION_COOKIE_SECRET, payload);
}

export async function setSession(
  data: Omit<Session, "expiresAt" | "sessionId">,
  options?: SetSessionOptions,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const iat = options?.iatSec ?? now;
  const exp =
    options?.maxAgeSeconds != null ? iat + options.maxAgeSeconds : sessionExpSec(iat, now);
  const maxAge = exp - now;
  const value = await buildSessionCookieValue(data, {
    iatSec: iat,
    ...(options?.sid != null ? { sid: options.sid } : {}),
    maxAgeSeconds: exp - iat,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, value, {
    ...sessionCookieBase(),
    maxAge,
  });
}

/**
 * Set `hc_session` on an explicit `NextResponse` (e.g. OAuth callback). Inserts `user_auth_sessions`.
 */
export async function applySessionToResponse(
  res: NextResponse,
  data: Omit<Session, "expiresAt" | "sessionId">,
  options?: { countryCode?: string | null },
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const iat = now;
  const exp = sessionExpSec(iat, now);
  const maxAge = exp - now;
  const sid = randomUUID();
  const value = await buildSessionCookieValue(
    { userId: data.userId, cognitoSub: data.cognitoSub, email: data.email },
    { iatSec: iat, sid, maxAgeSeconds: exp - iat },
  );
  res.cookies.set(SESSION_COOKIE_NAME, value, {
    ...sessionCookieBase(),
    maxAge,
  });
  const db = createDbClient(serverEnv.DATABASE_URL);
  try {
    await db.insert(userAuthSessions).values({
      sessionId: sid,
      userId: data.userId,
      countryCode: options?.countryCode ?? null,
    });
  } catch {
    /* ignore race */
  }
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
