import "server-only";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { isProductionCookieSecure } from "../env.server";

export const ONBOARDING_ACK_COOKIE = "hc_onboarding_ack";

const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

function cookieBase() {
  return {
    httpOnly: true,
    secure: isProductionCookieSecure() ? true : false,
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function hasOnboardingAck(): Promise<boolean> {
  const store = await cookies();
  return store.get(ONBOARDING_ACK_COOKIE)?.value === "1";
}

export async function setOnboardingAck(): Promise<void> {
  const store = await cookies();
  store.set(ONBOARDING_ACK_COOKIE, "1", {
    ...cookieBase(),
    maxAge: ONE_YEAR_SEC,
  });
}

export function clearOnboardingAckOnResponse(res: NextResponse): void {
  res.cookies.set(ONBOARDING_ACK_COOKIE, "", {
    ...cookieBase(),
    maxAge: 0,
  });
}
