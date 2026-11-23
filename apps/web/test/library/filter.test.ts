import { describe, expect, it } from "vitest";

import { filterLibraryModules, matchesSearchQuery, matchesStageFilter } from "@/lib/library/filter";
import type { LibraryModuleListItem } from "@/lib/library/types";

const bathing: LibraryModuleListItem = {
  slug: "daily-bathing-resistance",
  title: "Bathing: when the answer is no",
  category: "daily_care",
  stageRelevance: ["middle", "late"],
  summary: "Resistance to bathing is common.",
  topicTags: [
    { slug: "bathing-resistance", displayName: "Bathing resistance" },
    { slug: "refusal-of-care", displayName: "Refusal of care" },
  ],
};

const other: LibraryModuleListItem = {
  slug: "other",
  title: "Other",
  category: "behaviors",
  stageRelevance: ["late"],
  summary: "Something else",
  topicTags: [{ slug: "wandering", displayName: "Wandering" }],
};

describe("matchesSearchQuery", () => {
  it('matches the bathing module by title substring "bath"', () => {
    expect(matchesSearchQuery(bathing, "bath")).toBe(true);
  });

  it("matches by topic display name (bathing)", () => {
    expect(matchesSearchQuery(bathing, "Bathing res")).toBe(true);
  });

  it("matches summary text", () => {
    expect(matchesSearchQuery(bathing, "resistance")).toBe(true);
  });
});

describe("matchesStageFilter", () => {
  it('includes a module when "early" is not selected and filter is only middle/late (module has middle)', () => {
    expect(matchesStageFilter(bathing, new Set(["middle"]))).toBe(true);
  });

  it("excludes a module with only late when early is the sole selected filter", () => {
    expect(matchesStageFilter(bathing, new Set(["early"]))).toBe(false);
  });
});

describe("filterLibraryModules", () => {
  it("applies search and stage together", () => {
    const list = [bathing, other];
    const out = filterLibraryModules(list, "bath", new Set(["early"]));
    expect(out).toHaveLength(0);
  });
});
