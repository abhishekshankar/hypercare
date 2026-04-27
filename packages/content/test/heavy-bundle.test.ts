import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseHeavyModuleFromDisk } from "../src/heavy/parse-heavy-module-from-disk.js";
import { selectHeavyBranchMarkdown } from "../src/heavy/select-branch.js";
import { validateHeavyModule } from "../src/heavy/validate-heavy-module.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Monorepo root (`hypercare/`): `packages/content/test` → up three levels. */
const repoRoot = join(__dirname, "..", "..", "..");

const RELATION_TARGETS = new Set([
  "medical-diagnosis-demystified",
  "self-care-guilt-ambiguous-grief",
  "self-care-caregiver-burnout",
  "legal-advance-planning",
  "transitions-driving-conversation",
]);

describe("heavy bundle fixture (transitions-first-two-weeks)", () => {
  beforeAll(() => {
    process.env.CONTENT_MODULES_DIR = "packages/content/test/fixtures";
  });
  afterAll(() => {
    delete process.env.CONTENT_MODULES_DIR;
  });

  it("parses six branches, two tools, eight evidence rows, five relation edges", async () => {
    const parsed = await parseHeavyModuleFromDisk({ repoRoot, slug: "transitions-first-two-weeks" });
    expect(parsed.branches).toHaveLength(6);
    expect(parsed.tools).toHaveLength(2);
    expect(parsed.evidence).toHaveLength(8);
    expect(parsed.relations.edges).toHaveLength(5);
  });

  it("validates when relation targets exist in modules catalog", async () => {
    const parsed = await parseHeavyModuleFromDisk({ repoRoot, slug: "transitions-first-two-weeks" });
    const { errors, warnings } = validateHeavyModule(parsed, RELATION_TARGETS);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes("primary_topics"))).toBe(true);
  });

  it("selects early / parent / with_caregiver branch for matching care profile", async () => {
    const parsed = await parseHeavyModuleFromDisk({ repoRoot, slug: "transitions-first-two-weeks" });
    const { bodyMd, branch } = selectHeavyBranchMarkdown(parsed.branches, {
      stage: "early",
      relationship: "parent",
      livingSituation: "with_caregiver",
    });
    expect(branch.stageKey).toBe("early");
    expect(branch.relationshipKey).toBe("parent");
    expect(branch.livingSituationKey).toBe("with_caregiver");
    expect(bodyMd).toContain("You live here");
  });
});
