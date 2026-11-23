import { describe, expect, it } from "vitest";

import { verify } from "../src/layers/6-verify.js";
import { makeChunk } from "./fixtures.js";

const sources = [
  makeChunk({ chunkId: "c1", distance: 0.1, sectionHeading: "What is sundowning" }),
  makeChunk({
    chunkId: "c2",
    distance: 0.2,
    moduleSlug: "behaviors-sundowning",
    sectionHeading: "What helps",
  }),
];

describe("layer 6 — verify", () => {
  it("treats INSUFFICIENT_CONTEXT as a low_confidence refusal", () => {
    const r = verify({ rawText: "INSUFFICIENT_CONTEXT", sources });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.code).toBe("low_confidence");
  });

  it("rejects out-of-range citations", () => {
    const r = verify({
      rawText: "Sundowning is late-day agitation that often eases with routine [3].",
      sources,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.code).toBe("uncitable_response");
  });

  it("rejects when a claim-bearing sentence has no citation", () => {
    const r = verify({
      rawText:
        "Sundowning is a late-day pattern of agitation that often eases with routine. Try dim lights and a calm afternoon [1].",
      sources,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason.code).toBe("uncitable_response");
      if (r.reason.code === "uncitable_response") {
        expect(r.reason.stripped_sentences).toBeGreaterThan(0);
      }
    }
  });

  it("passes a fully-cited multi-sentence answer and returns deduped Citation[]", () => {
    const r = verify({
      rawText:
        "Sundowning is a late-day pattern of agitation that often eases with routine [1]. Try dim lights and a calm afternoon to help reduce it [1][2].",
      sources,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain("[1]");
      expect(r.citations.map((c) => c.chunkId)).toEqual(["c1", "c2"]);
      expect(r.citations[0]!.moduleSlug).toBe("behaviors-sundowning");
    }
  });

  it("ignores short non-claim sentences (greetings, hedges)", () => {
    const r = verify({
      rawText: "Got it. Sundowning is a late-day pattern that often eases with routine [1].",
      sources,
    });
    expect(r.ok).toBe(true);
  });

  it("does not rewrite the model's text — passes it through verbatim on success", () => {
    const text =
      "Sundowning is a late-day pattern of agitation that often eases with routine [1].";
    const r = verify({ rawText: `   ${text}\n  `, sources });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe(text);
  });

  it("refuses on empty model output", () => {
    const r = verify({ rawText: "   ", sources });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.code).toBe("uncitable_response");
  });
});
