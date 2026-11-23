import { describe, expect, it } from "vitest";

import { shouldShowCheckinFromLastPrompt } from "@/lib/home/checkin-cadence";

const now = new Date("2026-04-22T12:00:00.000Z");

describe("shouldShowCheckinFromLastPrompt", () => {
  it("no prior check-in → show", () => {
    const r = shouldShowCheckinFromLastPrompt(now, null, 0);
    expect(r).toEqual({ show: true, reason: "cadence" });
  });

  it("last check-in 4 days ago, no soft flags → do not show", () => {
    const last = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    const r = shouldShowCheckinFromLastPrompt(now, last, 0);
    expect(r.show).toBe(false);
  });

  it("last check-in 4 days ago, 2+ soft flags → show elevation", () => {
    const last = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    const r = shouldShowCheckinFromLastPrompt(now, last, 2);
    expect(r).toEqual({ show: true, reason: "soft_flag_elevation" });
  });

  it("last check-in today → do not show", () => {
    const last = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const r = shouldShowCheckinFromLastPrompt(now, last, 0);
    expect(r.show).toBe(false);
  });

  it("last check-in 8 days ago → show cadence", () => {
    const last = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const r = shouldShowCheckinFromLastPrompt(now, last, 0);
    expect(r).toEqual({ show: true, reason: "cadence" });
  });
});
