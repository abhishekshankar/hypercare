import { expect, test, type APIRequestContext } from "@playwright/test";

const e2eSecret = process.env.E2E_SETUP_SECRET ?? "";

async function seedOnboarded(
  request: APIRequestContext,
  baseURL: string | undefined,
  next: string,
  opts?: { inferred?: "early"; hardest?: string },
) {
  const p = new URLSearchParams();
  p.set("mode", "onboarded");
  p.set("next", next);
  if (opts?.inferred) {
    p.set("inferred", "early");
  }
  if (opts?.hardest) {
    p.set("hardest", opts.hardest);
  }
  return request.get(
    new URL(`/api/test/e2e-session?${p.toString()}`, baseURL).toString(),
    {
      headers: { "x-e2e-secret": e2eSecret },
      maxRedirects: 0,
    },
  );
}

test.describe("care profile (TASK-020)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(e2eSecret.length === 0, "E2E_SETUP_SECRET missing");
    const r = await seedOnboarded(page.request, baseURL, "/app/profile", { hardest: "sleep" });
    if (![302, 303, 307].includes(r.status())) {
      test.skip(
        true,
        `e2e-session returned ${r.status()} — set DATABASE_URL to a migrated Postgres for this test`,
      );
    }
  });

  test("About you: change hardest thing; recent changes shows update", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/app/profile`);
    const before = await (await page.request.get(`${baseURL}/api/app/profile/changes?limit=20`)).json() as {
      items: unknown[];
    };
    const n0 = before.items.length;
    const section = page.getByTestId("profile-section-about_you");
    await section.getByRole("button").first().click();
    await section.getByRole("button", { name: "Edit" }).click();
    const ta = page.getByTestId("profile-hardest-thing");
    await ta.clear();
    await ta.fill("guilt");
    await section.getByRole("button", { name: "Save" }).click();
    const after = await (await page.request.get(`${baseURL}/api/app/profile/changes?limit=20`)).json() as {
      items: { field: string; newValue: unknown }[];
    };
    expect(after.items.length).toBeGreaterThan(n0);
    await expect(page.getByTestId("profile-recent-changes")).toBeVisible();
    const guilt = after.items.find((i) => i.field === "hardest_thing");
    expect((guilt?.newValue as string | null)?.toString().toLowerCase()).toContain("guilt");
  });
});

test.describe("evolved flow (TASK-020)", () => {
  test.describe.configure({ mode: "serial" });

  test("save changed-flow after flipping stage: more change log rows", async ({ page, baseURL }) => {
    test.skip(e2eSecret.length === 0, "E2E_SETUP_SECRET missing");
    const seed = await seedOnboarded(page.request, baseURL, "/app", { inferred: "early" });
    if (![302, 303, 307].includes(seed.status())) {
      test.skip(true, "e2e DB unavailable");
    }
    const nBefore = (
      (await (await page.request.get(`${baseURL}/api/app/profile/changes?limit=50`)).json()) as {
        items: unknown[];
      }
    ).items.length;

    await page.goto(`${baseURL}/app/profile/changed`);
    await expect(page.getByTestId("changed-step-1")).toBeVisible();
    await page.locator('input[name="bathes_alone"][value="no"]').check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Skip for now" }).nth(0).click();
    await page.getByRole("button", { name: "Skip for now" }).nth(0).click();
    await page.getByRole("button", { name: "Skip for now" }).nth(0).click();
    await page.waitForURL((u) => u.pathname === "/app/profile");

    const nAfter = (
      (await (await page.request.get(`${baseURL}/api/app/profile/changes?limit=50`)).json()) as {
        items: { field: string }[];
      }
    ).items.length;
    expect(nAfter).toBeGreaterThan(nBefore);
  });

  test("skip all steps: change count unchanged", async ({ page, baseURL }) => {
    test.skip(e2eSecret.length === 0, "E2E_SETUP_SECRET missing");
    const seed = await seedOnboarded(page.request, baseURL, "/app");
    if (![302, 303, 307].includes(seed.status())) {
      test.skip(true, "e2e DB unavailable");
    }
    const n0 = (
      (await (await page.request.get(`${baseURL}/api/app/profile/changes?limit=50`)).json()) as {
        items: unknown[];
      }
    ).items.length;

    await page.goto(`${baseURL}/app/profile/changed`);
    for (let i = 0; i < 4; i += 1) {
      await page.getByRole("button", { name: "Skip for now" }).first().click();
    }
    await page.waitForURL((u) => u.pathname === "/app/profile", { timeout: 15_000 });

    const n1 = (
      (await (await page.request.get(`${baseURL}/api/app/profile/changes?limit=50`)).json()) as {
        items: unknown[];
      }
    ).items.length;
    expect(n1).toBe(n0);
  });
});
