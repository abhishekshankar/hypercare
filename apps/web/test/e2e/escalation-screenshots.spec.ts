/**
 * Captures 375px-wide screenshots of every PRD §10.3 escalation card and the
 * 24h home suppression card (TASK-025 report-back). Writes to
 * `docs/screenshots/task-025/`. Skipped unless `E2E_SETUP_SECRET` is set —
 * matches the gating used by the rest of the e2e suite.
 *
 * To regenerate locally:
 *   pnpm --filter web exec playwright test test/e2e/escalation-screenshots.spec.ts --workers=1
 */
import path from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";

const e2eSecret = process.env.E2E_SETUP_SECRET ?? "";
// Resolve relative to the package root (Playwright runs from `apps/web`).
const SHOT_DIR = path.resolve(process.cwd(), "../../docs/screenshots/task-025");

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
    { headers: { "x-e2e-secret": e2eSecret }, maxRedirects: 0 },
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

const SCENARIOS: ReadonlyArray<{
  filename: string;
  prompt: string;
  category: string;
}> = [
  {
    filename: "01-caregiver-self-harm.png",
    prompt: "I want to hurt myself, I can't keep doing this",
    category: "self_harm_user",
  },
  {
    filename: "02-medical-emergency.png",
    prompt: "She fell and hit her head and she's not responding",
    category: "acute_medical",
  },
  {
    filename: "03-care-recipient-in-danger.png",
    prompt: "She might hurt herself, I don't know what to do",
    category: "self_harm_cr",
  },
  {
    filename: "04-elder-abuse-breaking-point.png",
    prompt: "I lost my temper and pushed her tonight",
    category: "abuse_caregiver_to_cr",
  },
  {
    filename: "05-financial-exploitation.png",
    prompt: "He was forced to sign over the house under pressure",
    category: "abuse_cr_to_caregiver",
  },
  {
    filename: "06-dangerous-request.png",
    prompt: "Should I double the dose of her ativan tonight?",
    category: "neglect",
  },
];

test.describe.configure({ mode: "serial" });

test.use({ viewport: { width: 375, height: 1200 }, deviceScaleFactor: 2 });

test.describe("escalation card screenshots (TASK-025 report-back)", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(e2eSecret.length === 0, "E2E_SETUP_SECRET missing");
    const seed = await seedSession(page.request, baseURL, "/app");
    if (![302, 303, 307].includes(seed.status())) {
      test.skip(true, "DATABASE_URL not pointed at a migrated Postgres");
    }
    await installRagMock(page.request, baseURL);
  });

  test.afterEach(async ({ page, baseURL }) => {
    if (e2eSecret.length === 0) return;
    await clearRagMock(page.request, baseURL);
  });

  for (const s of SCENARIOS) {
    test(`captures ${s.filename}`, async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/app`);
      await page.getByTestId("composer-textarea").first().fill(s.prompt);
      await page.getByTestId("composer-submit").first().click();
      await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));
      const card = page.getByTestId("escalation-card");
      await expect(card).toBeVisible({ timeout: 15_000 });
      await expect(card).toHaveAttribute("data-triage-category", s.category);
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await card.screenshot({ path: path.join(SHOT_DIR, s.filename) });
    });
  }

  test("captures 07-home-suppression.png", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/app`);
    await page
      .getByTestId("composer-textarea")
      .first()
      .fill("I lost my temper and pushed her tonight");
    await page.getByTestId("composer-submit").first().click();
    await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));
    await expect(page.getByTestId("escalation-card")).toBeVisible({ timeout: 15_000 });

    await page.goto(`${baseURL}/app`);
    const card = page.getByTestId("suppression-card");
    await expect(card).toBeVisible();
    await card.screenshot({ path: path.join(SHOT_DIR, "07-home-suppression.png") });
  });
});
