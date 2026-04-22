import { expect, test } from "@playwright/test";

/**
 * E2E v1: proves `/api/auth/login` issues a PKCE authorize redirect to the Cognito Hosted UI host.
 * Full code→callback→DB path needs real secrets + PM-driven browser sign-in (see `docs/auth-runbook.md`).
 */
test("GET /api/auth/login redirects to Cognito authorize with code_challenge (PKCE)", async ({
  request,
  baseURL,
}) => {
  const r = await request.get(new URL("/api/auth/login?next=%2Fapp%2Fprofile", baseURL).toString(), {
    maxRedirects: 0,
  });
  expect([301, 302, 303, 307, 308]).toContain(r.status());
  const loc = r.headers().location;
  expect(loc).toBeTruthy();
  const u = new URL(loc!);
  expect(u.hostname).toMatch(/\.amazoncognito\.com$/i);
  expect(u.searchParams.get("code_challenge_method")).toBe("S256");
  expect((u.searchParams.get("code_challenge") ?? "").length).toBeGreaterThan(0);
  expect((u.searchParams.get("code_challenge") ?? "").length).toBeGreaterThan(40);
  expect((u.searchParams.get("client_id") ?? "").length).toBeGreaterThan(0);
  expect((u.searchParams.get("state") ?? "").length).toBeGreaterThan(0);
});

test("unauthenticated /app is redirected to login (middleware)", async ({ request, baseURL }) => {
  const r = await request.get(new URL("/app", baseURL).toString(), { maxRedirects: 0 });
  expect(r.status()).toBe(307);
  const loc = r.headers().location;
  expect(loc).toBeTruthy();
  expect(loc).toMatch(/api\/auth\/login/);
});

test("GET /auth/error returns 200 with sign-in recovery link", async ({ page }) => {
  await page.goto("/auth/error?reason=invalid_state");
  await expect(page.getByRole("heading", { level: 1, name: "Sign-in error" })).toBeVisible();
  await expect(
    page.getByText("Something went wrong during sign-in (invalid_state). Try again, or use Help for crisis resources."),
  ).toBeVisible();
  const retry = page.getByRole("link", { name: "Try sign-in again" });
  await expect(retry).toBeVisible();
  await expect(retry).toHaveAttribute("href", "/api/auth/login?next=%2Fapp");
});

test("GET /auth/error without reason still offers login retry", async ({ page }) => {
  await page.goto("/auth/error");
  await expect(page.getByRole("link", { name: "Try sign-in again" })).toHaveAttribute(
    "href",
    "/api/auth/login?next=%2Fapp",
  );
});
