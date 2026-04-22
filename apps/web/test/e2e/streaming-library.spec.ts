import { expect, test } from "@playwright/test";

const e2eSecret = process.env.E2E_SETUP_SECRET ?? "";

async function seedSession(
  next: string,
  page: import("@playwright/test").Page,
  baseURL: string | undefined,
) {
  return page.request.get(
    new URL(`/api/test/e2e-session?mode=onboarded&next=${encodeURIComponent(next)}`, baseURL).toString(),
    { headers: { "x-e2e-secret": e2eSecret }, maxRedirects: 0 },
  );
}

test.describe("library streaming (TASK-041)", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(e2eSecret.length === 0, "E2E_SETUP_SECRET missing");
    const r = await seedSession("/app/library", page, baseURL);
    if (![302, 303, 307].includes(r.status())) {
      test.skip(
        true,
        `e2e-session returned ${r.status().toString()} — set DATABASE_URL to a migrated Postgres for this test`,
      );
    }
  });

  test("flags off: client-side filter still works", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/app/library`);
    await expect(page.getByRole("heading", { name: "Library." })).toBeVisible();
    const moduleCards = page.getByTestId("library-module-card");
    if ((await moduleCards.count()) < 1) {
      test.skip(true, "No module cards — seed content for library e2e");
    }
    await page.getByTestId("library-search-input").fill("bath");
    await expect(page.getByText("Bathing: when the answer is no")).toBeVisible();
    await page.getByTestId("library-search-input").fill("");
    await expect(page.getByText("Bathing: when the answer is no")).toBeVisible();
  });

  test("flags on: first result shortly after query (requires E2E_STREAMING_LIBRARY=1 on webServer)", async ({
    page,
    baseURL,
  }) => {
    test.skip(
      process.env.E2E_STREAMING_LIBRARY !== "1",
      "Set E2E_STREAMING_LIBRARY=1 so Playwright injects STREAMING_LIBRARY + NEXT_PUBLIC_STREAMING_LIBRARY",
    );
    await page.goto(`${baseURL}/app/library`);
    const input = page.getByTestId("library-search-input");
    await input.fill("bath");
    const t0 = Date.now();
    await expect(page.getByTestId("library-module-card").first()).toBeVisible({ timeout: 500 });
    expect(Date.now() - t0).toBeLessThan(2500);
    await input.fill("");
    await expect(page.getByRole("heading", { name: "Library." })).toBeVisible();
  });
});
