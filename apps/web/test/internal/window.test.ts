import { describe, expect, it } from "vitest";

import { parseWindow, windowBounds } from "@/lib/internal/metrics/window";

describe("metrics window", () => {
  it("parseWindow defaults to 30d", () => {
    expect(parseWindow(null)).toBe("30d");
    expect(parseWindow("bad")).toBe("30d");
    expect(parseWindow("7d")).toBe("7d");
  });
  it("windowBounds all uses epoch start for SQL", () => {
    const end = new Date("2026-04-22T12:00:00.000Z");
    const a = windowBounds("all", end);
    expect(a.start).toBeNull();
    expect(a.end).toEqual(end);
  });
});
