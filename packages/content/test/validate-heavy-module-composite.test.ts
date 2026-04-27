import { describe, expect, it } from "vitest";

import type { HeavyDiskFrontmatter } from "../src/schema.js";
import type { ParsedHeavyModule } from "../src/heavy/parse-heavy-module-from-disk.js";
import { validateHeavyModule } from "../src/heavy/validate-heavy-module.js";

const baseFront: HeavyDiskFrontmatter = {
  slug: "test-heavy-composite",
  title: "Test",
  category: "medical",
  tier: 2,
  stage_relevance: ["early"],
  summary: "Summary line for tests.",
  attribution_line: "Attribution for tests.",
  expert_reviewer: null,
  review_date: null,
  topics: ["new-diagnosis", "understanding-diagnosis"],
  primary_topics: ["new-diagnosis", "understanding-diagnosis"],
  secondary_topics: [],
};

function minimalParsed(bodyMd: string): ParsedHeavyModule {
  return {
    dir: "",
    front: baseFront,
    bodyMd,
    branches: [
      {
        stageKey: "any",
        relationshipKey: "any",
        livingSituationKey: "any",
        bodyMd: "Fallback branch body.\n",
      },
    ],
    tools: [],
    evidence: [],
    relations: { module_slug: "test-heavy-composite", edges: [] },
  };
}

describe("validateHeavyModule composite first-person", () => {
  it("errors when composite prose contains first-person inside an opening quote", () => {
    const parsed = minimalParsed(
      'Intro\n\n<!-- provenance: composite -->\nMany say that after the visit: "I remember the silence."\n',
    );
    const { errors } = validateHeavyModule(parsed, new Set());
    expect(errors.some((e) => e.includes("first-person"))).toBe(true);
  });

  it("passes composite without first-person quote markers", () => {
    const parsed = minimalParsed(
      "Intro\n\n<!-- provenance: composite -->\nMany caregivers describe a strange split in the hours after the appointment.\n",
    );
    const { errors } = validateHeavyModule(parsed, new Set());
    expect(errors.filter((e) => e.includes("first-person"))).toEqual([]);
  });
});
