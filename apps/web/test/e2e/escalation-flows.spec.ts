/**
 * E2E coverage for the five PRD §10.3 escalation flows added in TASK-025
 * (caregiver-self-harm is already covered by `conversation.spec.ts`).
 *
 * Drives the conversation route end-to-end through `/api/test/conversation-mock`
 * so each category's pre-scripted card is rendered against the real DB without
 * Bedrock. Verifies:
 *   - Each category renders the EscalationCard with its category attribute.
 *   - The medical-emergency card exposes a tappable `tel:911` primary action.
 *   - The elder-abuse card carries the mandatory disclosure copy.
 *   - The home page swaps to the SuppressionCard for the two distress flows.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";

const e2eSecret = process.env.E2E_SETUP_SECRET ?? "";

async function seedSession(
  request: APIRequestContext,
  baseURL: string | undefined,
  next: string,
) {
  return request.get(
    new URL(
      `/api/test/e2e-session?mode=onboarded&next=${encodeURIComponent(next)}`,
      baseURL,
    ).toString(),
    {
      headers: { "x-e2e-secret": e2eSecret },
      maxRedirects: 0,
    },
  );
}

async function installRagMock(request: APIRequestContext, baseURL: string | undefined) {
  const r = await request.post(
    new URL("/api/test/conversation-mock", baseURL).toString(),
    { headers: { "x-e2e-secret": e2eSecret } },
  );
  expect(r.status()).toBe(200);
}

async function clearRagMock(request: APIRequestContext, baseURL: string | undefined) {
  await request.delete(
    new URL("/api/test/conversation-mock", baseURL).toString(),
    { headers: { "x-e2e-secret": e2eSecret } },
  );
}

test.describe.configure({ mode: "serial" });

test.describe("escalation flows v1 (TASK-025 / PRD §10.3)", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(e2eSecret.length === 0, "E2E_SETUP_SECRET missing");
    const seed = await seedSession(page.request, baseURL, "/app");
    if (![302, 303, 307].includes(seed.status())) {
      test.skip(
        true,
        `e2e-session returned ${seed.status()} — set DATABASE_URL to a migrated Postgres for this test`,
      );
    }
    await installRagMock(page.request, baseURL);
  });

  test.afterEach(async ({ page, baseURL }) => {
    if (e2eSecret.length === 0) return;
    await clearRagMock(page.request, baseURL);
  });

  test("medical emergency renders the 911-first card with a tappable 911 action", async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/app`);
    await page
      .getByTestId("composer-textarea")
      .first()
      .fill("She fell and hit her head and she's not responding");
    await page.getByTestId("composer-submit").first().click();
    await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));

    const card = page.getByTestId("escalation-card");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute("data-triage-category", "acute_medical");

    const primary = page.getByTestId("escalation-primary-resource").first();
    await expect(primary).toHaveAttribute("href", "tel:911");
  });

  test("care recipient self-harm renders the CR-in-danger script", async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/app`);
    await page
      .getByTestId("composer-textarea")
      .first()
      .fill("She might hurt herself, I don't know what to do");
    await page.getByTestId("composer-submit").first().click();
    await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));

    const card = page.getByTestId("escalation-card");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute("data-triage-category", "self_harm_cr");
  });

  test("elder abuse / breaking-point card carries the mandatory disclosure", async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/app`);
    await page
      .getByTestId("composer-textarea")
      .first()
      .fill("I lost my temper and pushed her tonight");
    await page.getByTestId("composer-submit").first().click();
    await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));

    const card = page.getByTestId("escalation-card");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute(
      "data-triage-category",
      "abuse_caregiver_to_cr",
    );
    await expect(card).toContainText(/report|adult protective|aps|state/i);
  });

  test("financial / legal exploitation card points at APS and the Eldercare Locator", async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/app`);
    await page
      .getByTestId("composer-textarea")
      .first()
      .fill("He was forced to sign over the house under pressure");
    await page.getByTestId("composer-submit").first().click();
    await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));

    const card = page.getByTestId("escalation-card");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute(
      "data-triage-category",
      "abuse_cr_to_caregiver",
    );
    await expect(card).toContainText(/eldercare locator|adult protective|elder abuse/i);
  });

  test("dangerous request (dosing) refuses with the dangerous-request script", async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/app`);
    await page
      .getByTestId("composer-textarea")
      .first()
      .fill("Should I double the dose of her ativan tonight?");
    await page.getByTestId("composer-submit").first().click();
    await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));

    const card = page.getByTestId("escalation-card");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute("data-triage-category", "neglect");
  });

  test("home page suppresses focus + check-in for 24h after a distress flag", async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/app`);
    await page
      .getByTestId("composer-textarea")
      .first()
      .fill("I lost my temper and pushed her tonight");
    await page.getByTestId("composer-submit").first().click();
    await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));
    await expect(page.getByTestId("escalation-card")).toBeVisible({ timeout: 15_000 });

    await page.goto(`${baseURL}/app`);
    await expect(page.getByTestId("suppression-card")).toBeVisible();
    await expect(page.getByTestId("weeks-focus-card")).toHaveCount(0);
    await expect(page.getByTestId("weekly-checkin-card")).toHaveCount(0);
  });
});
