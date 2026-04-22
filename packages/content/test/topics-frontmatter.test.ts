import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseModuleFile } from "../src/parse.js";
import { moduleFrontMatterSchema } from "../src/schema.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "../../..");
const bathPath = join(repoRoot, "content/modules/daily-bathing-resistance.md");

describe("moduleFrontMatterSchema topics", () => {
  it("accepts a valid topics array (inline)", () => {
    const d = moduleFrontMatterSchema.parse({
      slug: "x-y",
      title: "T",
      category: "behaviors",
      tier: 1,
      stage_relevance: ["early"],
      summary: "S",
      attribution_line: "A",
      expert_reviewer: null,
      review_date: null,
      topics: ["sundowning", "agitation-aggression"],
    });
    expect(d.topics).toHaveLength(2);
  });

  it("rejects an unknown topic slug with a clear message", () => {
    const r = moduleFrontMatterSchema.safeParse({
      slug: "x-y",
      title: "T",
      category: "behaviors",
      tier: 1,
      stage_relevance: ["early"],
      summary: "S",
      attribution_line: "A",
      expert_reviewer: null,
      review_date: null,
      topics: ["not-a-real-slug-xyz", "sundowning"],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.map((i) => i.message).join(" ");
      expect(msg).toMatch(/Unknown topic slug "not-a-real-slug-xyz"/);
    }
  });
});

describe("parseModuleFile (seeded module files)", () => {
  it("reads topics from daily-bathing-resistance.md", async () => {
    const p = await parseModuleFile(bathPath);
    expect(p.front.topics.length).toBeGreaterThanOrEqual(2);
    expect(p.front.topics).toContain("bathing-resistance");
  });
});
