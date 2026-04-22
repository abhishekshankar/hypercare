import { describe, expect, it } from "vitest";

import { createSseParser, parseSseDataJson } from "@/lib/sse";

describe("createSseParser", () => {
  it("parses events split across chunks", () => {
    const seen: { event: string; data: string }[] = [];
    const p = createSseParser((e) => {
      seen.push(e);
    });
    const enc = new TextEncoder();
    p.push(enc.encode('event: chunk\nda'));
    p.push(enc.encode('ta: {"text":"hi"}\n\n'));
    p.end();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.event).toBe("chunk");
    expect(parseSseDataJson(seen[0]!.data)).toEqual({ text: "hi" });
  });

  it("returns null for malformed JSON in data", () => {
    expect(parseSseDataJson("not json")).toBe(null);
  });
});
