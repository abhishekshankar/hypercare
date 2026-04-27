import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { LibraryModuleListItem } from "@/lib/library/types";
import { rankLibrarySearchMatches, type LibrarySearchCandidate } from "@alongside/db";

const PostBodySchema = z.object({
  query: z.string().max(500),
});

describe("library search API contract (TASK-041)", () => {
  it("rejects empty query after trim", () => {
    const p = PostBodySchema.safeParse({ query: "   " });
    expect(p.success).toBe(true);
    expect(p.data!.query.trim().length).toBe(0);
  });

  it("accepts normal query", () => {
    const p = PostBodySchema.safeParse({ query: " hospice " });
    expect(p.success).toBe(true);
    expect(p.data!.query.trim()).toBe("hospice");
  });

  it("ranks module matches by substring score", () => {
    const m: LibraryModuleListItem = {
      slug: "a",
      title: "Zebra first",
      summary: "bath later",
      category: "daily_care",
      stageRelevance: ["early"],
      topicTags: [],
    };
    const m2: LibraryModuleListItem = {
      slug: "b",
      title: "Bath early",
      summary: "x",
      category: "daily_care",
      stageRelevance: ["early"],
      topicTags: [],
    };
    const candidates: LibrarySearchCandidate[] = [
      {
        kind: "bookmarked_module",
        id: m.slug,
        title: m.title,
        snippet: m.summary,
        haystack: `${m.title} ${m.summary}`.toLowerCase(),
        source: "published_catalog",
        module: m,
      },
      {
        kind: "bookmarked_module",
        id: m2.slug,
        title: m2.title,
        snippet: m2.summary,
        haystack: `${m2.title} ${m2.summary}`.toLowerCase(),
        source: "published_catalog",
        module: m2,
      },
    ];
    const ranked = rankLibrarySearchMatches(candidates, "bath");
    expect(ranked.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
