import { describe, expect, it } from "vitest";

import { createSseParser, parseSseDataJson } from "@/lib/sse";

describe("SSE card event (TASK-040)", () => {
  it("parses `card` like `chunk`", () => {
    const seen: { event: string; data: string }[] = [];
    const p = createSseParser((e) => {
      seen.push(e);
    });
    const enc = new TextEncoder();
    p.push(
      enc.encode('event: card\ndata: {"index":0,"kind":"intro","body_md":"# H"}\n\n'),
    );
    p.end();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.event).toBe("card");
    expect(parseSseDataJson(seen[0]!.data)).toEqual({
      index: 0,
      kind: "intro",
      body_md: "# H",
    });
  });
});
