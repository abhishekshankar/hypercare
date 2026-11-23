import { expect, test } from "@playwright/test";

const e2eSecret = process.env.E2E_SETUP_SECRET ?? "";

test.describe("help & burnout", () => {
  test.describe.configure({ mode: "serial" });

  test("help page blocks, helpline link, and burnout red-severe → soft flag", async ({ page, baseURL, request }) => {
    test.skip(e2eSecret.length === 0, "E2E_SETUP_SECRET missing");
    const seed = await page.request.get(
      new URL(`/api/test/e2e-session?mode=onboarded&next=${encodeURIComponent("/help")}`, baseURL).toString(),
      { headers: { "x-e2e-secret": e2eSecret }, maxRedirects: 0 },
    );
    if (![302, 303, 307].includes(seed.status())) {
      test.skip(
        true,
        `e2e-session returned ${seed.status()} — set DATABASE_URL to a migrated Postgres for this test`,
      );
    }

    await page.goto(`${baseURL}/help`);
    await expect(page.getByTestId("help-page")).toBeVisible();
    await expect(page.getByTestId("help-checklists")).toBeVisible();
    await expect(page.getByTestId("help-burnout-cta")).toBeVisible();
    await expect(page.getByTestId("help-footer")).toBeVisible();
    const helpline = page.getByTestId("right-now-helpline-alz");
    await expect(helpline).toBeVisible();
    await expect(helpline).toHaveAttribute("href", "tel:+18002723900");

    await page.goto(`${baseURL}/help/burnout-check`);
    for (let i = 0; i < 7; i++) {
      await page.getByTestId(`burnout-q${i}-option-4`).check();
    }
    await page.getByTestId("burnout-submit").click();
    await expect(page.getByTestId("burnout-result")).toBeVisible();
    await expect(page.getByTestId("burnout-severe-988-cta")).toBeVisible();

    const flagRes = await request.get(
      new URL("/api/test/e2e-safety-flags?limit=5", baseURL).toString(),
      { headers: { "x-e2e-secret": e2eSecret } },
    );
    expect(flagRes.status()).toBe(200);
    const body = (await flagRes.json()) as {
      flags: { category: string; severity: string; source: string }[];
    };
    const latest = body.flags[0];
    expect(latest).toBeDefined();
    expect(latest?.category).toBe("self_care_burnout");
    expect(latest?.source).toBe("burnout_self_assessment");
    expect(latest?.severity).toBe("medium");
  });
});
