import { NextRequest, NextResponse } from "next/server";

import { OAUTH_SCOPES_STRING } from "@/lib/auth/config";
import { OAUTH_COOKIE_TTL_SEC, OAUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { signPayload } from "@/lib/auth/cookie";
import { logAuthError } from "@/lib/auth/log";
import { createCodeChallenge, createCodeVerifier } from "@/lib/auth/pkce";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { callbackUrl, isProductionCookieSecure, serverEnv } from "@/lib/env.server";
import type { OauthStatePayload } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

/**
 * @see [TASK-006] PKCE + state cookie, redirect to Cognito /oauth2/authorize.
 */
export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  try {
    const nextParam = request.nextUrl.searchParams.get("next");
    const next = safeNextPath(nextParam, "/app");
    const verifier = createCodeVerifier();
    const challenge = await createCodeChallenge(verifier);
    const state = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + OAUTH_COOKIE_TTL_SEC;
    const oauthPayload: OauthStatePayload = {
      state,
      codeVerifier: verifier,
      next,
      iat: now,
      exp,
    };
    const oauthCookie = await signPayload(
      serverEnv.SESSION_COOKIE_SECRET,
      oauthPayload,
    );
    const cognitoAuth = new URL(
      new URL(serverEnv.COGNITO_DOMAIN).origin + "/oauth2/authorize",
    );
    cognitoAuth.searchParams.set("client_id", serverEnv.COGNITO_APP_CLIENT_ID);
    cognitoAuth.searchParams.set("response_type", "code");
    cognitoAuth.searchParams.set("scope", OAUTH_SCOPES_STRING);
    cognitoAuth.searchParams.set("redirect_uri", callbackUrl());
    cognitoAuth.searchParams.set("state", state);
    cognitoAuth.searchParams.set("code_challenge_method", "S256");
    cognitoAuth.searchParams.set("code_challenge", challenge);
    const res = NextResponse.redirect(cognitoAuth.toString());
    res.cookies.set(OAUTH_COOKIE_NAME, oauthCookie, {
      httpOnly: true,
      secure: isProductionCookieSecure() ? true : false,
      sameSite: "lax",
      path: "/",
      maxAge: OAUTH_COOKIE_TTL_SEC,
    });
    return res;
  } catch (e) {
    const reason = "login";
    logAuthError({
      stage: "auth_login",
      reason,
      ...(requestId != null ? { requestId } : {}),
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.redirect(
      new URL(
        `/auth/error?reason=${encodeURIComponent(reason)}`,
        request.nextUrl.origin,
      ),
    );
  }
}
