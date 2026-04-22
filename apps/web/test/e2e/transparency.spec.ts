import { expect, test, type APIRequestContext } from "@playwright/test";

const e2eSecret = process.env.E2E_SETUP_SECRET ?? "";

async function seedOnboarded(request: APIRequestContext, baseURL: string | undefined, next: string) {
  return request.get(
    new URL(`/api/test/e2e-session?mode=onboarded&next=${encodeURIComponent(next)}`, baseURL).toString(),
    {
      headers: { "x-e2e-secret": e2eSecret },
      maxRedirects: 0,
    },
  );
}

test.describe("profile transparency (TASK-033)", () => {
  test("memory and citations sections render on profile", async ({ page, baseURL }) => {
    test.skip(e2eSecret.length === 0, "E2E_SETUP_SECRET missing");
    const seed = await seedOnboarded(page.request, baseURL, "/app/profile");
    if (![302, 303, 307].includes(seed.status())) {
      test.skip(true, `e2e-session returned ${seed.status()}`);
    }
    await page.goto(`${baseURL}/app/profile`);
    await expect(page.getByTestId("transparency-memory-section")).toBeVisible();
    await expect(page.getByRole("heading", { name: "What Hypercare remembers from our conversations" })).toBeVisible();
    await expect(page.getByTestId("transparency-citations-section")).toBeVisible();
    await expect(page.getByRole("heading", { name: "What we've cited to you recently" })).toBeVisible();
  });
});
