import { describe, expect, it } from "vitest";

import { scoreBurnout } from "./burnout-score.js";

const seven = (n: number) => Array.from({ length: 7 }, () => n);

describe("scoreBurnout", () => {
  it("rejects wrong length", () => {
    expect(() => scoreBurnout([0, 0, 0])).toThrow();
  });

  it("rejects out-of-range item", () => {
    expect(() => scoreBurnout([0, 0, 0, 0, 0, 0, 5])).toThrow();
  });

  it("boundary: 7 → green, 8 → amber, 14 → amber, 15 → red, 21 → red, 22 → red_severe, 28 → red_severe", () => {
    expect(scoreBurnout(seven(1))).toEqual({ score: 7, band: "green" });
    expect(scoreBurnout([1, 1, 1, 1, 1, 1, 2])).toEqual({ score: 8, band: "amber" });
    expect(scoreBurnout([2, 2, 2, 2, 2, 2, 0])).toEqual({ score: 12, band: "amber" });
    // max in amber: 2*6 + 2 = 14? 2*7=14
    expect(scoreBurnout(seven(2))).toEqual({ score: 14, band: "amber" });
    expect(scoreBurnout([2, 2, 2, 2, 2, 2, 3])).toEqual({ score: 15, band: "red" });
    expect(scoreBurnout(seven(3))).toEqual({ score: 21, band: "red" });
    expect(scoreBurnout([3, 3, 3, 3, 3, 3, 4])).toEqual({ score: 22, band: "red_severe" });
    expect(scoreBurnout(seven(4))).toEqual({ score: 28, band: "red_severe" });
  });
});
