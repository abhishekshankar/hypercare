import { expect, test, type Page } from "@playwright/test";

const e2eSecret = process.env.E2E_SETUP_SECRET ?? "";

async function seed(
  page: Page,
  baseURL: string | undefined,
  params: Record<string, string>,
): Promise<boolean> {
  const p = new URLSearchParams({ mode: "onboarded", next: "/app", ...params });
  const r = await page.request.get(
    new URL(`/api/test/e2e-session?${p.toString()}`, baseURL).toString(),
    { headers: { "x-e2e-secret": e2eSecret }, maxRedirects: 0 },
  );
  return [302, 303, 307].includes(r.status());
}

function focusSlugFromCta(href: string | null): string | null {
  if (href == null) {
    return null;
  }
  const m = /\/app\/lesson\/([^/?#]+)/.exec(href);
  return m ? decodeURIComponent(m[1]!) : null;
}

test.describe("lesson loop (TASK-024)", () => {
  test.beforeEach(async () => {
    test.skip(e2eSecret.length === 0, "E2E_SETUP_SECRET missing");
  });

  test("home shows this week's focus; lesson route loads with setup card", async ({
    page,
    baseURL,
  }) => {
    test.skip(!(await seed(page, baseURL, {})), "e2e-session redirect failed");
    await page.goto(new URL("/app", baseURL).toString());
    await expect(page.getByTestId("weeks-focus-card")).toBeVisible({ timeout: 30_000 });
    const cta = page.getByTestId("weeks-focus-cta");
    if ((await cta.count()) === 0) {
      test.skip(true, "no_pick — content not seeded in this DB");
    }
    await cta.click();
    await expect(page).toHaveURL(/\/app\/lesson\//);
    await expect(page.getByTestId("lesson-page")).toBeVisible();
    await expect(page.getByTestId("lesson-card-setup")).toBeVisible();
  });

  test("walks all six cards via Next; Got it returns to /app?saved=1", async ({
    page,
    baseURL,
  }) => {
    test.skip(!(await seed(page, baseURL, {})), "e2e-session redirect failed");
    await page.goto(new URL("/app", baseURL).toString());
    const cta = page.getByTestId("weeks-focus-cta");
    if ((await cta.count()) === 0) {
      test.skip(true, "no_pick — content not seeded");
    }
    await cta.click();
    await expect(page.getByTestId("lesson-card-setup")).toBeVisible();

    const next = page.getByRole("button", { name: /Next/ });
    // Setup -> 3 core -> try -> close = 5 forward steps total
    for (let i = 0; i < 5; i++) {
      await next.click();
      await expect(page.getByTestId("lesson-card-pos")).toContainText(`${i + 2} / 6`);
    }
    await expect(page.getByTestId("lesson-close-card")).toBeVisible();
    const got = page.getByTestId("lesson-got-it");
    // Wait for `progressId` to populate so the Got it button is enabled.
    await expect(got).toBeEnabled({ timeout: 10_000 });
    await got.click();
    await page.waitForURL(/\/app\?saved=1/);
    await expect(page.getByTestId("lesson-saved-banner")).toBeVisible();
  });

  test("anti-repeat: completing a focus module rotates next pick (or shows no_pick)", async ({
    page,
    baseURL,
  }) => {
    // First load: capture the initial focus slug.
    test.skip(!(await seed(page, baseURL, {})), "e2e-session redirect failed");
    await page.goto(new URL("/app", baseURL).toString());
    const cta = page.getByTestId("weeks-focus-cta");
    if ((await cta.count()) === 0) {
      test.skip(true, "no_pick — no library seeded");
    }
    const firstSlug = focusSlugFromCta(await cta.getAttribute("href"));
    expect(firstSlug).not.toBeNull();

    // Reseed: mark the same slug as completed 3 days ago.
    const ok = await seed(page, baseURL, {
      completed_slug: firstSlug!,
      completed_days_ago: "3",
    });
    test.skip(!ok, "e2e-session reseed failed");

    await page.goto(new URL("/app", baseURL).toString());
    const cta2 = page.getByTestId("weeks-focus-cta");
    if ((await cta2.count()) === 0) {
      // no_pick is an acceptable outcome of the anti-repeat policy when the
      // library is too small to rotate to another stage-relevant module.
      await expect(page.getByTestId("weeks-focus-card")).toContainText(/library|Nothing new/);
      return;
    }
    const secondSlug = focusSlugFromCta(await cta2.getAttribute("href"));
    expect(secondSlug).not.toBe(firstSlug);
  });

  test("check-in card hidden when a recent check-in exists", async ({ page, baseURL }) => {
    test.skip(!(await seed(page, baseURL, { checkin_days_ago: "1" })), "seed failed");
    await page.goto(new URL("/app", baseURL).toString());
    await expect(page.getByTestId("weeks-focus-card")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("weekly-checkin-card")).toHaveCount(0);
  });

  test("check-in card visible when last check-in is older than 7 days", async ({
    page,
    baseURL,
  }) => {
    test.skip(!(await seed(page, baseURL, { checkin_days_ago: "10" })), "seed failed");
    await page.goto(new URL("/app", baseURL).toString());
    await expect(page.getByTestId("weekly-checkin-card")).toBeVisible({ timeout: 30_000 });
  });

  test("check-in elevation: 2+ soft flags + last check-in 4 days ago shows card", async ({
    page,
    baseURL,
  }) => {
    test.skip(
      !(await seed(page, baseURL, { checkin_days_ago: "4", soft_flags: "2" })),
      "seed failed",
    );
    await page.goto(new URL("/app", baseURL).toString());
    await expect(page.getByTestId("weekly-checkin-card")).toBeVisible({ timeout: 30_000 });
  });
});
