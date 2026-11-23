import { expect, test, type APIRequestContext } from "@playwright/test";

const e2eSecret = process.env.E2E_SETUP_SECRET ?? "";

async function seedSession(
  request: APIRequestContext,
  baseURL: string | undefined,
  next: string,
) {
  const r = await request.get(
    new URL(`/api/test/e2e-session?mode=onboarded&next=${encodeURIComponent(next)}`, baseURL).toString(),
    {
      headers: { "x-e2e-secret": e2eSecret },
      maxRedirects: 0,
    },
  );
  return r;
}

async function installRagMock(request: APIRequestContext, baseURL: string | undefined) {
  const r = await request.post(new URL("/api/test/conversation-mock", baseURL).toString(), {
    headers: { "x-e2e-secret": e2eSecret },
  });
  expect(r.status()).toBe(200);
}

async function clearRagMock(request: APIRequestContext, baseURL: string | undefined) {
  await request.delete(new URL("/api/test/conversation-mock", baseURL).toString(), {
    headers: { "x-e2e-secret": e2eSecret },
  });
}

// All four flows hit the same test user (`e2e-onboarding-playwright`) and the
// `beforeEach` deletes+re-seeds its `care_profile` row, so parallel workers
// race on the unique `care_profile.user_id` constraint. Run serially.
test.describe.configure({ mode: "serial" });

test.describe("conversation flow", () => {
  // Use `page.request` (NOT the `request` fixture) so the cookies the seed
  // route sets land in the same BrowserContext storage that `page.goto` uses.
  // The top-level `request` fixture is a separate APIRequestContext; cookies
  // set on it do not flow to `page` (TASK-013).
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

  test("home renders greeting + 3 starter chips + recent conversations", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/app`);
    await expect(page.getByText(/Good (morning|afternoon|evening), Alex\./)).toBeVisible();
    await expect(page.getByText("Caring for Margaret.")).toBeVisible();
    const chips = page.getByTestId("starter-chip");
    await expect(chips).toHaveCount(3);
    // Middle-stage starter set per starters.ts
    await expect(chips.nth(0)).toHaveText("Afternoon agitation");
    await expect(page.getByTestId("recent-conversations")).toContainText(
      "No conversations yet.",
    );
  });

  test("starter chip → answered turn with clickable citation expansion", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/app`);
    await page.getByTestId("starter-chip").nth(0).click();

    await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));
    // Auto-submitted prefill produces a user bubble + assistant answer. The
    // fixture answer references the same source twice ("[1] ... [1]"), so the
    // composer renders two identical chips for the same citation — pick the
    // first.
    const sourceChip = page.getByRole("button", { name: /^Source 1/ }).first();
    await expect(sourceChip).toBeVisible({ timeout: 15_000 });

    // Citation chip toggles inline expansion (not a tooltip).
    await expect(page.getByTestId("citation-expansion")).toHaveCount(0);
    await sourceChip.click();
    const expansion = page.getByTestId("citation-expansion");
    await expect(expansion).toBeVisible();
    await expect(expansion).toContainText("What is sundowning");
    await expect(expansion).toContainText(
      "Adapted from the Alzheimer's Association caregiver guide, 2024.",
    );
    await expect(expansion.getByRole("link", { name: /Read the full module/ })).toHaveAttribute(
      "href",
      "/app/modules/behaviors-sundowning",
    );

    // Reload reconstructs the thread from the DB.
    const url = page.url();
    await page.goto(url);
    await expect(page.getByRole("button", { name: /^Source 1/ }).first()).toBeVisible();
    await expect(page.getByText(/Late-day agitation is common in dementia/)).toBeVisible();
  });

  test("crisis question routes through safety_triaged + pulses CrisisStrip", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/app`);
    const composer = page.getByTestId("composer-textarea").first();
    await composer.fill("I want to kill myself.");
    await page.getByTestId("composer-submit").first().click();

    await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));
    const triage = page.getByTestId("triage-card");
    await expect(triage).toBeVisible({ timeout: 15_000 });
    await expect(triage).toHaveAttribute("data-triage-category", "self_harm_user");
    await expect(page.getByTestId("triage-primary-action")).toHaveAttribute("href", "tel:988");
    // No grounded answer rendered alongside the triage card.
    await expect(page.locator('[data-role="assistant"]:not([data-testid="assistant-refusal"])')).toHaveCount(0);
    // CrisisStrip pulses for the lifetime of the triage card.
    await expect(page.getByTestId("crisis-strip")).toHaveAttribute("data-pulse", "true");
  });

  test("CrisisStrip un-pulses when leaving the conversation (TriageCard unmount cleanup)", async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/app`);
    const composer = page.getByTestId("composer-textarea").first();
    await composer.fill("I want to end it all.");
    await page.getByTestId("composer-submit").first().click();
    await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));
    await expect(page.getByTestId("triage-card")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("crisis-strip")).toHaveAttribute("data-pulse", "true");

    await page.goto(`${baseURL}/app`);
    await expect(page.getByTestId("crisis-strip")).not.toHaveAttribute("data-pulse", "true");
  });

  test("CrisisStrip un-pulses after a non-triaged follow-up (ref-count / pub-sub cleanup)", async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/app`);
    const composer = page.getByTestId("composer-textarea").first();
    await composer.fill("I want to hurt myself.");
    await page.getByTestId("composer-submit").first().click();
    await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));
    await expect(page.getByTestId("triage-card")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("crisis-strip")).toHaveAttribute("data-pulse", "true");

    await composer.fill("Tell me about afternoon agitation and sundowning.");
    await page.getByTestId("composer-submit").first().click();
    await expect(
      page.getByText(/Late-day agitation is common in dementia/),
    ).toBeVisible({ timeout: 15_000 });
    // Historical triage turn stays in the thread, but the strip must not stay pulsed
    // once the latest assistant turn is a normal answer.
    await expect(page.getByTestId("triage-card")).toHaveCount(1);
    await expect(page.getByTestId("crisis-strip")).not.toHaveAttribute("data-pulse", "true");
  });

  test("off-topic question shows the off_topic refusal card", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/app`);
    const composer = page.getByTestId("composer-textarea").first();
    await composer.fill("What is the capital of France?");
    await page.getByTestId("composer-submit").first().click();

    await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));
    const card = page.getByTestId("refusal-card");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute("data-refusal-code", "off_topic");
    await expect(card).toContainText("outside what I can help with");
    // Off-topic should NOT pulse the crisis strip.
    await expect(page.getByTestId("crisis-strip")).not.toHaveAttribute("data-pulse", "true");
  });
});
