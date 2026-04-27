/**
 * Unit tests for the 24h home-screen suppression layer (TASK-025 / PRD §10.3).
 *
 * The drizzle client is mocked so we can assert insert/update/delete decisions
 * around the suppression window without a live Postgres.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env.server", () => ({
  serverEnv: { DATABASE_URL: "postgresql://127.0.0.1:5432/hc_test" },
}));

type Row = { userId: string; until: Date; reason: string; setAt: Date };

const state: { rows: Row[] } = { rows: [] };
const calls: { inserts: unknown[]; updates: unknown[]; deletes: number } = {
  inserts: [],
  updates: [],
  deletes: 0,
};

vi.mock("@alongside/db", () => {
  return {
    userSuppression: {
      _: "user_suppression",
      userId: "user_suppression.user_id",
      until: "user_suppression.until",
    },
    createDbClient: () => ({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => state.rows.slice(0, 1),
          }),
        }),
      }),
      insert: () => ({
        values: async (row: Row) => {
          calls.inserts.push(row);
          state.rows = [{ ...row, setAt: row.setAt ?? new Date() }];
        },
      }),
      update: () => ({
        set: (s: Partial<Row>) => {
          calls.updates.push(s);
          return {
            where: async () => {
              if (state.rows[0]) {
                state.rows[0] = { ...state.rows[0], ...s } as Row;
              }
            },
          };
        },
      }),
      delete: () => ({
        where: async () => {
          calls.deletes += 1;
          state.rows = [];
        },
      }),
    }),
  };
});

import {
  applySuppressionForTriageCategory,
  getSuppressionStatus,
} from "@/lib/safety/user-suppression";

const userId = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-04-22T12:00:00.000Z");
const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  state.rows = [];
  calls.inserts.length = 0;
  calls.updates.length = 0;
  calls.deletes = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("applySuppressionForTriageCategory", () => {
  it("inserts a 24h row for caregiver self-harm (self_harm_user)", async () => {
    await applySuppressionForTriageCategory(userId, "self_harm_user", NOW);
    expect(calls.inserts).toHaveLength(1);
    const row = calls.inserts[0] as Row;
    expect(row.userId).toBe(userId);
    expect(row.reason).toBe("caregiver_self_harm");
    expect(row.until.getTime()).toBe(NOW.getTime() + TWENTY_FOUR_H_MS);
    expect(calls.updates).toHaveLength(0);
  });

  it("inserts a 24h row for caregiver→CR abuse (abuse_caregiver_to_cr)", async () => {
    await applySuppressionForTriageCategory(userId, "abuse_caregiver_to_cr", NOW);
    expect(calls.inserts).toHaveLength(1);
    expect((calls.inserts[0] as Row).reason).toBe(
      "elder_abuse_or_caregiver_breaking_point",
    );
  });

  it("is a no-op for non-distress categories (e.g. acute_medical)", async () => {
    await applySuppressionForTriageCategory(userId, "acute_medical", NOW);
    expect(calls.inserts).toHaveLength(0);
    expect(calls.updates).toHaveLength(0);
  });

  it("extends an earlier expiry to NOW+24h (sliding window)", async () => {
    const earlierUntil = new Date(NOW.getTime() + 30 * 60 * 1000);
    state.rows = [
      {
        userId,
        until: earlierUntil,
        reason: "caregiver_self_harm",
        setAt: NOW,
      },
    ];

    await applySuppressionForTriageCategory(userId, "self_harm_user", NOW);

    expect(calls.inserts).toHaveLength(0);
    expect(calls.updates).toHaveLength(1);
    const set = calls.updates[0] as Partial<Row>;
    expect(set.until?.getTime()).toBe(NOW.getTime() + TWENTY_FOUR_H_MS);
    expect(set.reason).toBe("caregiver_self_harm");
  });

  it("does not shorten a still-longer expiry from a prior incident", async () => {
    const longerUntil = new Date(NOW.getTime() + 36 * 60 * 60 * 1000);
    state.rows = [
      {
        userId,
        until: longerUntil,
        reason: "caregiver_self_harm",
        setAt: NOW,
      },
    ];

    await applySuppressionForTriageCategory(userId, "self_harm_user", NOW);

    expect(calls.inserts).toHaveLength(0);
    expect(calls.updates).toHaveLength(1);
    expect((calls.updates[0] as Partial<Row>).until?.getTime()).toBe(
      longerUntil.getTime(),
    );
  });

  it("overwrites the reason when the newer category differs", async () => {
    state.rows = [
      {
        userId,
        until: new Date(NOW.getTime() + 5 * 60 * 1000),
        reason: "caregiver_self_harm",
        setAt: NOW,
      },
    ];

    await applySuppressionForTriageCategory(userId, "abuse_caregiver_to_cr", NOW);

    expect(calls.updates).toHaveLength(1);
    expect((calls.updates[0] as Partial<Row>).reason).toBe(
      "elder_abuse_or_caregiver_breaking_point",
    );
  });
});

describe("getSuppressionStatus", () => {
  it("reports inactive when no row exists", async () => {
    const s = await getSuppressionStatus(userId, NOW);
    expect(s).toEqual({ active: false });
    expect(calls.deletes).toBe(0);
  });

  it("reports active with ISO until + reason when row is in the future", async () => {
    const until = new Date(NOW.getTime() + 6 * 60 * 60 * 1000);
    state.rows = [
      { userId, until, reason: "caregiver_self_harm", setAt: NOW },
    ];

    const s = await getSuppressionStatus(userId, NOW);

    expect(s.active).toBe(true);
    expect(s.until).toBe(until.toISOString());
    expect(s.reason).toBe("caregiver_self_harm");
    expect(calls.deletes).toBe(0);
  });

  it("garbage-collects an expired row and reports inactive", async () => {
    const past = new Date(NOW.getTime() - 60 * 1000);
    state.rows = [
      { userId, until: past, reason: "caregiver_self_harm", setAt: past },
    ];

    const s = await getSuppressionStatus(userId, NOW);

    expect(s).toEqual({ active: false });
    expect(calls.deletes).toBe(1);
  });
});
