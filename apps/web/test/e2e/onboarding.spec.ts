import { expect, test } from "@playwright/test";

const e2eSecret = process.env.E2E_SETUP_SECRET ?? "";

test("onboarding: full wizard, summary, home, then /onboarding redirects to /app", async ({
  page,
  baseURL,
}) => {
  test.skip(e2eSecret.length === 0, "E2E_SETUP_SECRET missing");

  const sessionRes = await page.request.get(
    new URL("/api/test/e2e-session?next=/onboarding/step/1", baseURL).toString(),
    {
      headers: { "x-e2e-secret": e2eSecret },
      maxRedirects: 0,
    },
  );
  if (![302, 303, 307].includes(sessionRes.status())) {
    test.skip(
      true,
      `e2e-session returned ${sessionRes.status()} — set DATABASE_URL to a migrated Postgres for this test`,
    );
  }

  await page.goto(`${baseURL}/onboarding/step/1`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "About the person you care for",
  );

  await page.getByLabel("Their first name").fill("Margaret");
  await page.getByLabel(/Their age/i).fill("78");
  await page.getByRole("radio", { name: "Parent" }).check();
  // cr_diagnosis <option value> list: apps/web/src/components/onboarding/step-1-form.tsx
  await page.getByLabel(/Diagnosis/i).selectOption({ value: "alzheimers" });
  await page.getByLabel(/Year of diagnosis/i).fill("2020");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("day-to-day");
  await expect(page.getByText(/need help remembering or taking their medications/i)).toBeVisible();
  await page.getByRole("radio", { name: "They manage on their own" }).check();
  await page.getByRole("radio", { name: "Yes — safely" }).check();
  await page
    .getByRole("group", { name: /Safety worries when alone/i })
    .getByText("Nothing in particular")
    .click();
  await page.getByRole("radio", { name: "Yes, usually" }).check();
  await page.getByRole("radio", { name: "On their own" }).check();
  await page
    .locator("fieldset")
    .filter({ hasText: /gotten lost or wandered/i })
    .getByRole("radio", { name: "No" })
    .check();
  await page
    .locator("fieldset")
    .filter({ hasText: /conversation that makes sense/i })
    .getByRole("radio", { name: "Yes" })
    .check();
  await page.getByRole("radio", { name: "Mostly sleeps through" }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel(/Where do they live/i).selectOption("with_caregiver");
  await page.getByLabel(/Who else is involved/i).selectOption("solo");
  await page.getByRole("radio", { name: "Same home" }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel(/Your first name/i).fill("Alex");
  await page.getByRole("radio", { name: "55–64" }).check();
  await page.getByRole("radio", { name: "Working" }).check();
  await page.getByRole("radio", { name: /1 — I've got this/i }).check();
  await page.getByLabel(/hardest thing/i).fill("Sundowning most evenings.");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: /See what I told Alongside/i }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("what we heard");
  await expect(page.getByText(/Okay\./)).toBeVisible();
  await page.getByRole("button", { name: "Looks right" }).click();

  await page.waitForURL("**/app");
  await expect(page.getByText(/Good (morning|afternoon|evening), Alex\./)).toBeVisible();
  await expect(page.getByText("Caring for Margaret.")).toBeVisible();

  const again = await page.request.get(new URL("/onboarding", baseURL).toString(), {
    maxRedirects: 0,
  });
  expect([302, 303, 307]).toContain(again.status());
  const loc = again.headers()["location"] ?? "";
  expect(loc).toMatch(/\/app(\?.*)?$/);
});
