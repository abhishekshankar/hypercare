import { describe, expect, it } from "vitest";

import { createSseParser, parseSseDataJson } from "@/lib/sse";

describe("SSE result events (TASK-041)", () => {
  it("parses library `result` events", () => {
    const seen: { event: string; data: string }[] = [];
    const p = createSseParser((e) => {
      seen.push(e);
    });
    const enc = new TextEncoder();
    p.push(
      enc.encode(
        `event: result\ndata: ${JSON.stringify({ id: "m1", kind: "bookmarked_module", title: "T", snippet: "S", score: 999, source: "x" })}\n\n`,
      ),
    );
    p.end();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.event).toBe("result");
    const row = parseSseDataJson<{
      id?: string;
      kind?: string;
      score?: number;
    }>(seen[0]!.data);
    expect(row?.id).toBe("m1");
    expect(row?.kind).toBe("bookmarked_module");
    expect(row?.score).toBe(999);
  });
});
