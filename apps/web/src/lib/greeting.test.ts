import { describe, expect, it } from "vitest";

import { greetingForLocalHour } from "./greeting";

describe("greetingForLocalHour", () => {
  it("morning", () => {
    expect(greetingForLocalHour(8)).toBe("Good morning");
  });
  it("afternoon", () => {
    expect(greetingForLocalHour(14)).toBe("Good afternoon");
  });
  it("evening", () => {
    expect(greetingForLocalHour(20)).toBe("Good evening");
  });
});
