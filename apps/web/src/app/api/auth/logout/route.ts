import { NextRequest, NextResponse } from "next/server";

import { logAuthError } from "@/lib/auth/log";
import { clearSessionOnResponse } from "@/lib/auth/session";
import { clearOnboardingAckOnResponse } from "@/lib/onboarding/ack";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

/**
 * Clear Hypercare session then redirect to Cognito `/logout` (POST per TASK-006).
 */
export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  try {
    const logout = new URL(
      new URL(serverEnv.COGNITO_DOMAIN).origin + "/logout",
    );
    logout.searchParams.set("client_id", serverEnv.COGNITO_APP_CLIENT_ID);
    logout.searchParams.set("logout_uri", serverEnv.AUTH_SIGNOUT_URL);
    const res = NextResponse.redirect(logout.toString());
    clearSessionOnResponse(res);
    clearOnboardingAckOnResponse(res);
    return res;
  } catch (e) {
    logAuthError({
      stage: "auth_logout",
      reason: "logout",
      ...(requestId != null ? { requestId } : {}),
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.redirect(
      new URL(
        "/auth/error?reason=logout",
        request.nextUrl.origin,
      ),
    );
  }
}
