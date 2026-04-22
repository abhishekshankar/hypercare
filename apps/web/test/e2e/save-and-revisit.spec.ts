import { expect, test, type APIRequestContext } from "@playwright/test";

const e2eSecret = process.env.E2E_SETUP_SECRET ?? "";

async function seedSession(
  request: APIRequestContext,
  baseURL: string | undefined,
  next: string,
) {
  return request.get(
    new URL(`/api/test/e2e-session?mode=onboarded&next=${encodeURIComponent(next)}`, baseURL).toString(),
    { headers: { "x-e2e-secret": e2eSecret }, maxRedirects: 0 },
  );
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

test.describe.configure({ mode: "serial" });

test.describe("saved answers + revisit", () => {
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

  test("Save this + note + home section + jump + saves list + remove flow", async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/app`);
    await page.getByTestId("starter-chip").nth(0).click();
    await page.waitForURL(new RegExp(`/app/conversation/[0-9a-f-]+`));

    const saveBtn = page.getByTestId("save-this-button");
    await expect(saveBtn).toBeVisible({ timeout: 15_000 });
    await saveBtn.click();
    await expect(saveBtn).toContainText("Saved");

    const note = page.getByTestId("save-note-input");
    await expect(note).toBeVisible();
    await note.fill("for the conversation with my sister");
    await note.blur();
    await page.waitForTimeout(400);

    const convUrl = page.url();
    await page.reload();
    await expect(page.getByTestId("save-this-button")).toContainText("Saved");
    await expect(page.getByTestId("save-note-input")).toHaveValue("for the conversation with my sister");

    await page.goto(`${baseURL}/app`);
    const revisit = page.getByTestId("things-to-revisit");
    await expect(revisit).toContainText("Things to revisit");
    await expect(revisit).not.toContainText("Nothing saved yet");

    await revisit.locator("ul li a").first().click();
    await page.waitForURL(/\/app\/conversation\/[0-9a-f-]+#message-/);
    expect(page.url()).toContain("#message-");

    await page.goto(`${baseURL}/app/saves`);
    await expect(page.getByRole("heading", { name: "Saved answers" })).toBeVisible();
    await expect(page.getByText(/for the conversation with my sister/)).toBeVisible();

    const search = page.getByTestId("saves-search");
    await search.fill("zzzznonexistent12345");
    await page.waitForTimeout(500);
    await expect(page.getByText("No saves match that search.")).toBeVisible();

    await search.fill("");
    await page.waitForTimeout(500);
    await expect(page.getByText(/for the conversation with my sister/)).toBeVisible();

    const removeFirst = page.getByRole("button", { name: "Remove" }).first();
    await removeFirst.click();
    await expect(page.getByTestId("saves-undo-toast")).toBeVisible();
    await page.waitForTimeout(6000);
    await expect(page.getByTestId("saves-undo-toast")).toHaveCount(0);

    await page.reload();
    await expect(page.getByText("Nothing saved yet.")).toBeVisible();

    await page.goto(convUrl.split("#")[0] ?? convUrl);
    await expect(page.getByTestId("save-this-button")).toContainText("Save this", { timeout: 15_000 });
  });
});
