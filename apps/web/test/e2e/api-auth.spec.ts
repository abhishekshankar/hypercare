import { expect, test } from "@playwright/test";

/**
 * Route Handlers must return 401 without a session — same auth contract as
 * page-level redirects, but easy to miss when only UI flows are tested.
 */
test.describe("app API unauthenticated", () => {
  test("POST /api/app/conversation/start without cookie returns 401", async ({ request, baseURL }) => {
    const r = await request.post(`${baseURL}/api/app/conversation/start`, {
      data: { text: "hello" },
    });
    expect(r.status()).toBe(401);
  });

  test("GET /api/app/conversation/{id} without cookie returns 401", async ({ request, baseURL }) => {
    const r = await request.get(
      `${baseURL}/api/app/conversation/00000000-0000-0000-0000-000000000001`,
    );
    expect(r.status()).toBe(401);
  });

  test("POST /api/app/conversation/{id}/message without cookie returns 401", async ({ request, baseURL }) => {
    const r = await request.post(
      `${baseURL}/api/app/conversation/00000000-0000-0000-0000-000000000001/message`,
      {
        data: { text: "hello" },
      },
    );
    expect(r.status()).toBe(401);
  });
});
