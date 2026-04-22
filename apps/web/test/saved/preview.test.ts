import { describe, expect, it } from "vitest";

import { buildAssistantPreview } from "@/lib/saved/preview";

describe("buildAssistantPreview", () => {
  it("strips markdown headings and bold, returns at most 280 chars", () => {
    const raw =
      "## Heading\n\n**Bold** start and _italic_ plus " + "word ".repeat(100);
    const out = buildAssistantPreview(raw, 280);
    expect(out.startsWith("Heading")).toBe(true);
    expect(out).not.toContain("**");
    expect(out.length).toBeLessThanOrEqual(281);
  });

  it("handles plain text under limit unchanged (after strip)", () => {
    expect(buildAssistantPreview("Hello world.", 280)).toBe("Hello world.");
  });
});
