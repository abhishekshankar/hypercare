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

test.describe("library (requires seeded modules in DATABASE_URL)", () => {
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

  test("library list, search, stage filter, module page + lesson CTA", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/app/library`);
    await expect(page.getByRole("heading", { name: "Library." })).toBeVisible();

    const moduleCards = page.getByTestId("library-module-card");
    if ((await moduleCards.count()) < 1) {
      test.skip(
        true,
        "No module cards — run pnpm --filter @hypercare/content load against this DATABASE_URL with TASK-023 front-matter",
      );
    }

    expect(await moduleCards.count()).toBeGreaterThanOrEqual(3);

    await expect(page.getByText("Bathing: when the answer is no")).toBeVisible();
    await expect(page.getByText("Sundowning: afternoon and evening agitation")).toBeVisible();
    await expect(page.getByText("Caregiver burnout: when the tank is empty")).toBeVisible();

    await page.getByTestId("library-search-input").fill("bath");
    await expect(page.getByText("Bathing: when the answer is no")).toBeVisible();
    await expect(page.getByText("Sundowning: afternoon and evening agitation")).toHaveCount(0);

    await page.getByTestId("library-search-input").fill("");

    await page.getByTestId("library-stage-early").click();
    await expect(page.getByText("Bathing: when the answer is no")).toHaveCount(0);

    await page.getByTestId("library-module-card").filter({ hasText: "Sundowning" }).click();
    await expect(page).toHaveURL(new RegExp(`${String(baseURL)}/app/modules/behavior-sundowning`));
    await expect(page.getByTestId("module-article-body")).toBeVisible();
    await expect(page.getByTestId("module-attribution")).toBeVisible();
    await expect(page.getByTestId("module-cta-lesson")).toHaveAttribute("href", /\/app\/lesson\/behavior-sundowning/);
  });
});
