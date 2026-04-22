import { describe, expect, it } from "vitest";

import type { MemoryTransparencySection } from "@/lib/transparency/memory-display";
import {
  parseMemoryTransparencySections,
  stripForgottenBulletsFromSummary,
} from "@/lib/transparency/memory-display";

const sample = `## Current focus
- First topic here.

## What's been tried
- — (none noted).

## Open threads
- Worry one

## Signals the model should carry forward
- Evening pacing
`;

describe("transparency memory render (TASK-033)", () => {
  it("parses separate bullets per heading and omits empty sections", () => {
    const sections = parseMemoryTransparencySections(sample);
    const headings = sections.map((s: MemoryTransparencySection) => s.heading);
    expect(headings).toContain("Current focus");
    expect(headings).toContain("Open threads");
    expect(headings).not.toContain("What's been tried");
    const focus = sections.find((s: MemoryTransparencySection) => s.heading === "Current focus");
    expect(focus?.bullets).toEqual(["First topic here."]);
  });

  it("stripForgottenBulletsFromSummary removes matching bullets and drops empty headings", () => {
    const stripped = stripForgottenBulletsFromSummary(sample, ["Worry one"]);
    expect(stripped).not.toContain("Worry one");
    expect(stripped).toContain("First topic here.");
    expect(stripped.includes("Open threads")).toBe(false);
  });
});
