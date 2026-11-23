import { describe, expect, it } from "vitest";

import { anonymizedHandle } from "@/lib/feedback/anon-handle";

describe("anonymizedHandle", () => {
  it("masks display names", () => {
    expect(anonymizedHandle("Jordan", "00000000-0000-4000-8000-000000000001")).toBe("J•••n");
  });
  it("falls back to member id", () => {
    expect(anonymizedHandle(null, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toMatch(/^Member/);
  });
});
