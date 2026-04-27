import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const getSession = vi.fn();
const insertValues = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/auth/session", () => ({
  getSession: () => getSession(),
}));

vi.mock("@/lib/env.server", () => ({
  serverEnv: { DATABASE_URL: "postgresql://127.0.0.1:5432/hc_test" },
}));

vi.mock("@alongside/db", () => ({
  createDbClient: () => ({
    insert: () => ({
      values: (row: unknown) => {
        insertValues(row);
        return Promise.resolve();
      },
    }),
  }),
  safetyFlags: { _: "safety_flags" },
}));

describe("POST /api/app/help/burnout", () => {
  beforeEach(() => {
    insertValues.mockClear();
    getSession.mockResolvedValue({ userId: "user-1", cognitoSub: "s", email: "a@b.c", expiresAt: 1 });
  });

  it("no flag write for green (sum < 8)", async () => {
    const res = await POST(
      new Request("http://localhost/api/app/help/burnout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: [0, 0, 0, 0, 0, 0, 0] }),
      }),
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean; band: string };
    expect(j.band).toBe("green");
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("no flag write for amber", async () => {
    const res = await POST(
      new Request("http://localhost/api/app/help/burnout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: [1, 1, 1, 1, 1, 1, 2] }),
      }),
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { band: string };
    expect(j.band).toBe("amber");
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("writes low severity for red (15–21)", async () => {
    const res = await POST(
      new Request("http://localhost/api/app/help/burnout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: [2, 2, 2, 2, 2, 2, 3] }),
      }),
    );
    expect(res.status).toBe(200);
    expect(insertValues).toHaveBeenCalledOnce();
    const row = insertValues.mock.calls[0]![0] as { severity: string; source: string; category: string };
    expect(row.severity).toBe("low");
    expect(row.source).toBe("burnout_self_assessment");
    expect(row.category).toBe("self_care_burnout");
  });

  it("writes medium severity for red_severe (22+), not low+medium", async () => {
    insertValues.mockClear();
    const res = await POST(
      new Request("http://localhost/api/app/help/burnout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: [3, 3, 3, 3, 3, 3, 4] }),
      }),
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { band: string };
    expect(j.band).toBe("red_severe");
    expect(insertValues).toHaveBeenCalledOnce();
    const row = insertValues.mock.calls[0]![0] as { severity: string };
    expect(row.severity).toBe("medium");
  });
});
