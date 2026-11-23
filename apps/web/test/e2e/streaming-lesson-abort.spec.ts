import { expect, test, type Page } from "@playwright/test";

const e2eSecret = process.env.E2E_SETUP_SECRET ?? "";
const streamOn =
  process.env.STREAMING_LESSONS === "1" && process.env.NEXT_PUBLIC_STREAMING_LESSONS === "1";

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

test.describe("streaming lesson abort (TASK-040)", () => {
  test.beforeEach(async () => {
    test.skip(e2eSecret.length === 0, "E2E_SETUP_SECRET missing");
    test.skip(
      !streamOn,
      "set STREAMING_LESSONS=1 and NEXT_PUBLIC_STREAMING_LESSONS=1 for the app under test",
    );
  });

  test("Escape mid-stream returns to /app and shows cancelled toast", async ({ page, baseURL }) => {
    test.skip(!(await seed(page, baseURL, {})), "e2e-session redirect failed");
    await page.goto(new URL("/app", baseURL).toString());
    const cta = page.getByTestId("weeks-focus-cta");
    if ((await cta.count()) === 0) {
      test.skip(true, "no_pick");
    }
    await cta.click();
    await expect(page).toHaveURL(/\/app\/lesson\//);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/app\?lesson_cancel=1/, { timeout: 10_000 });
    await expect(page.getByTestId("lesson-cancel-toast")).toBeVisible();
  });
});
