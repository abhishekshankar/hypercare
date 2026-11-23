import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../src/config.js";
import { findNextCommitEnd } from "../../src/streaming/commit-buffer.js";
import { fastPathVerifyChunk } from "../../src/streaming/fast-path-verifier.js";

describe("streaming commit buffer", () => {
  const cfg = {
    minChars: DEFAULT_CONFIG.streamCommitMinChars,
    tailReserve: DEFAULT_CONFIG.streamCommitTailReserve,
  };

  it("does not commit when the draft is shorter than tail reserve", () => {
    const s = "x".repeat(119) + ". ";
    expect(findNextCommitEnd(s, 0, cfg)).toBe(null);
  });

  it("commits the first eligible sentence when there is enough headroom before the reserve", () => {
    const head = `${"x".repeat(150)}. `;
    const tail = "y".repeat(250);
    const s2 = head + tail;
    const end = findNextCommitEnd(s2, 0, cfg);
    expect(end).toBe(head.length);
  });

  it("advances committed pointer across multiple sentences", () => {
    const sent1 = `${"a".repeat(150)}. `;
    const sent2 = `${"b".repeat(150)}. `;
    const tail = "z".repeat(250);
    const full = sent1 + sent2 + tail;
    let committed = 0;
    const first = findNextCommitEnd(full, committed, cfg);
    expect(first).toBe(sent1.length);
    committed = first!;
    const second = findNextCommitEnd(full, committed, cfg);
    expect(second).toBe(sent1.length + sent2.length);
  });
});

describe("fast-path verifier", () => {
  it("rejects medication-like tokens", () => {
    const r = fastPathVerifyChunk("Ask their doctor about donepezil dosing.");
    expect(r.ok).toBe(false);
  });

  it("rejects I recommend", () => {
    const r = fastPathVerifyChunk("I recommend you change their medication today.");
    expect(r.ok).toBe(false);
  });

  it("allows neutral caregiving text", () => {
    const r = fastPathVerifyChunk(
      "Try offering one step at a time when they resist bathing. It can help reduce overwhelm [1].",
    );
    expect(r.ok).toBe(true);
  });
});
