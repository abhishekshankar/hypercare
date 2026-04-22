import { describe, expect, it } from "vitest";

import {
  buildLessonSlidesData,
  materializeStreamCards,
  slidesToStreamCards,
  streamCardToSlideData,
} from "@/lib/lesson/slice-stream";

import type { ModulePagePayload } from "@/lib/library/load-module";

const baseMod = (bodyMd: string): ModulePagePayload => ({
  id: "00000000-0000-4000-8000-000000000001",
  slug: "test",
  title: "T",
  bodyMd,
  category: "x",
  categoryLabel: "X",
  stageRelevance: ["early"],
  summary: "S",
  attributionLine: "A",
  expertReviewer: null,
  reviewDate: null,
  tryThisToday: "try",
  topicTags: [],
});

describe("lesson slice stream (TASK-040)", () => {
  it("async materialize matches sync slidesToStreamCards", () => {
    const mod = baseMod("## A\n\none\n\n## B\n\ntwo\n\n## C\n\nthree");
    const sync = slidesToStreamCards(buildLessonSlidesData(mod, "Pat", "early"));
    const mat = materializeStreamCards(mod, "Pat", "early");
    expect(mat).toEqual(sync);
  });

  it("streamCardToSlideData inverts intro", () => {
    const c = { index: 0, kind: "intro" as const, body_md: "# Title\n\nline\n\nextra" };
    const s = streamCardToSlideData(c);
    expect(s.kind).toBe("setup");
    if (s.kind === "setup") {
      expect(s.title).toBe("Title");
      expect(s.line).toBe("line");
      expect(s.stageNote).toBe("extra");
    }
  });
});
