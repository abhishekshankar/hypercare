import { describe, expect, it } from "vitest";

import { parseLessonSource, type LessonSource } from "@/lib/lesson/source";

describe("parseLessonSource", () => {
  it("maps known query values", () => {
    const table: { raw: string | null; want: LessonSource }[] = [
      { raw: "weekly_focus", want: "weekly_focus" },
      { raw: "library_browse", want: "library_browse" },
      { raw: "search", want: "search" },
      { raw: "conversation_link", want: "conversation_link" },
    ];
    for (const row of table) {
      expect(parseLessonSource(row.raw)).toBe(row.want);
    }
  });

  it("defaults to library_browse", () => {
    expect(parseLessonSource(null)).toBe("library_browse");
    expect(parseLessonSource("")).toBe("library_browse");
    expect(parseLessonSource("nope")).toBe("library_browse");
  });
});
