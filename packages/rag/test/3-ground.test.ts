import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../src/config.js";
import { ground } from "../src/layers/3-ground.js";
import { makeChunk } from "./fixtures.js";

describe("layer 3 — grounding decision", () => {
  it("refuses with no_content when there are zero hits", () => {
    const r = ground({ hits: [], config: DEFAULT_CONFIG });
    expect(r.decision).toBe("refuse");
    if (r.decision === "refuse") expect(r.reason.code).toBe("no_content");
  });

  it("refuses with off_topic when top-1 distance is very large", () => {
    const r = ground({
      hits: [makeChunk({ distance: 0.95, category: "behaviors" })],
      config: DEFAULT_CONFIG,
    });
    expect(r.decision).toBe("refuse");
    if (r.decision === "refuse") {
      expect(r.reason.code).toBe("off_topic");
      if (r.reason.code === "off_topic") {
        expect(r.reason.matched_category).toBe("behaviors");
      }
    }
  });

  it("refuses with low_confidence when top-1 distance exceeds the primary threshold", () => {
    const r = ground({
      hits: [
        makeChunk({ distance: 0.55 }),
        makeChunk({ distance: 0.58 }),
        makeChunk({ distance: 0.6 }),
      ],
      config: DEFAULT_CONFIG,
    });
    expect(r.decision).toBe("refuse");
    if (r.decision === "refuse") expect(r.reason.code).toBe("low_confidence");
  });

  it("refuses when too few hits are within the secondary threshold", () => {
    const r = ground({
      hits: [
        makeChunk({ distance: 0.2 }),
        makeChunk({ distance: 0.7 }),
        makeChunk({ distance: 0.75 }),
      ],
      config: DEFAULT_CONFIG,
    });
    expect(r.decision).toBe("refuse");
    if (r.decision === "refuse") expect(r.reason.code).toBe("low_confidence");
  });

  it("answers with up to maxChunksForPrompt chunks when confidence holds", () => {
    const hits = [
      makeChunk({ chunkId: "a", distance: 0.1 }),
      makeChunk({ chunkId: "b", distance: 0.2 }),
      makeChunk({ chunkId: "c", distance: 0.3 }),
      makeChunk({ chunkId: "d", distance: 0.4 }),
      makeChunk({ chunkId: "e", distance: 0.5 }),
      makeChunk({ chunkId: "f", distance: 0.55 }),
    ];
    const r = ground({ hits, config: DEFAULT_CONFIG });
    expect(r.decision).toBe("answer");
    if (r.decision === "answer") {
      expect(r.chunks).toHaveLength(DEFAULT_CONFIG.maxChunksForPrompt);
      expect(r.chunks[0]!.chunkId).toBe("a");
    }
  });
});
