import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";

import { OAUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { verifyPayload } from "@/lib/auth/cookie";
import { verifyCognitoIdToken } from "@/lib/auth/jwks";
import { formatErrorForLog, logAuthError } from "@/lib/auth/log";
import { redirectToLoginRetry } from "@/lib/auth/redirect-login-retry";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { applySessionToResponse } from "@/lib/auth/session";
import { clearOnboardingAckOnResponse } from "@/lib/onboarding/ack";
import type { OauthStatePayload } from "@/lib/auth/types";
import { upsertUserFromClaims } from "@/lib/auth/users";
import { callbackUrl, isProductionCookieSecure, serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

type TokenResponse = {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
};

function errRedirect(
  request: NextRequest,
  requestId: string | undefined,
  code: string,
  detail?: string,
) {
  logAuthError({
    stage: "auth_callback",
    reason: code,
    ...(requestId != null ? { requestId } : {}),
    ...(detail != null ? { message: detail } : {}),
  });
  return NextResponse.redirect(
    new URL(`/auth/error?reason=${encodeURIComponent(code)}`, request.nextUrl.origin),
  );
}

export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (code == null || state == null) {
    return errRedirect(request, requestId, "missing_code", "code or state missing");
  }
  const oauthRaw = request.cookies.get(OAUTH_COOKIE_NAME)?.value;
  const oauth = await verifyPayload<OauthStatePayload>(
    serverEnv.SESSION_COOKIE_SECRET,
    oauthRaw,
  );
  if (oauth == null) {
    return errRedirect(request, requestId, "invalid_state", "oauth cookie");
  }
  const now = Math.floor(Date.now() / 1000);
  if (oauth.exp < now) {
    return errRedirect(request, requestId, "invalid_state", "oauth cookie expired");
  }
  if (oauth.state !== state) {
    return errRedirect(request, requestId, "invalid_state", "state mismatch");
  }
  const basic = Buffer.from(
    `${serverEnv.COGNITO_APP_CLIENT_ID}:${serverEnv.COGNITO_APP_CLIENT_SECRET}`,
  ).toString("base64");
  const tokenUrl = new URL(
    new URL(serverEnv.COGNITO_DOMAIN).origin + "/oauth2/token",
  );
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl(),
    client_id: serverEnv.COGNITO_APP_CLIENT_ID,
    code_verifier: oauth.codeVerifier,
  });
  let tokenRes: Response;
  try {
    tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body,
    });
  } catch (e) {
    return errRedirect(
      request,
      requestId,
      "token_exchange",
      e instanceof Error ? e.message : "fetch",
    );
  }
  const tokenJson = (await tokenRes.json()) as TokenResponse;
  if (!tokenRes.ok || !tokenJson.id_token) {
    return errRedirect(
      request,
      requestId,
      "token_exchange",
      tokenJson.error ?? tokenRes.statusText,
    );
  }
  let idClaims: Awaited<ReturnType<typeof verifyCognitoIdToken>>;
  try {
    idClaims = await verifyCognitoIdToken(tokenJson.id_token);
  } catch (e) {
    return errRedirect(
      request,
      requestId,
      "invalid_token",
      e instanceof Error ? e.message : "verify",
    );
  }
  let user: { id: string; email: string; cognitoSub: string };
  try {
    user = await upsertUserFromClaims(idClaims);
  } catch (e) {
    logAuthError({
      stage: "auth_callback",
      reason: "user_upsert",
      ...(requestId != null ? { requestId } : {}),
      message: formatErrorForLog(e),
    });
    return redirectToLoginRetry(request, oauth.next);
  }
  const res = NextResponse.redirect(
    new URL(
      safeNextPath(oauth.next, "/app"),
      request.nextUrl.origin,
    ).toString(),
  );
  clearOnboardingAckOnResponse(res);
  res.cookies.set(OAUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProductionCookieSecure() ? true : false,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  await applySessionToResponse(res, {
    userId: user.id,
    cognitoSub: user.cognitoSub,
    email: user.email,
  });
  return res;
}
