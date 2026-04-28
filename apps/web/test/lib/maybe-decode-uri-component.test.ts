import { describe, expect, it } from "vitest";

import { maybeDecodePercentEncoding } from "@/lib/url/maybe-decode-uri-component";

describe("maybeDecodePercentEncoding", () => {
  it("returns plain text unchanged", () => {
    expect(maybeDecodePercentEncoding("When to consider memory care")).toBe(
      "When to consider memory care",
    );
  });

  it("decodes one layer of percent-encoding", () => {
    expect(maybeDecodePercentEncoding("what%20should%20i%20do%20in%20the%20evening%3F")).toBe(
      "what should i do in the evening?",
    );
  });

  it("returns input on malformed escape sequences", () => {
    expect(maybeDecodePercentEncoding("bad%ZZ")).toBe("bad%ZZ");
  });
});
