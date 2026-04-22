import { describe, expect, it } from "vitest";

import { streamCardToSlideData } from "@/lib/lesson/slice-stream";

/**
 * Contract tests for server → client `card` mapping (TASK-040 `streaming-render` ticket).
 */
describe("streaming render mapping", () => {
  it("maps check_in index 4 to try and 5 to close", () => {
    const t = streamCardToSlideData({ index: 4, kind: "check_in", body_md: "One thing." });
    expect(t.kind).toBe("try");
    if (t.kind === "try") {
      expect(t.text).toBe("One thing.");
    }
    const c = streamCardToSlideData({ index: 5, kind: "check_in", body_md: "" });
    expect(c.kind).toBe("close");
  });
});
