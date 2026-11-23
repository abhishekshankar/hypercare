import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseEscalationMarkdown, parseFrontmatter } from "../src/scripts/parse.js";

const _d = fileURLToPath(new URL(".", import.meta.url));
const SCRIPTS = resolve(_d, "../src/scripts");

describe("escalation scripts (TASK-025)", () => {
  it("every public script has frontmatter + version + direct answer", () => {
    const files = readdirSync(SCRIPTS)
      .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
      .sort();
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const f of files) {
      const raw = readFileSync(join(SCRIPTS, f), "utf8");
      const { data, body } = parseFrontmatter(raw);
      expect(data.version, f).toBeTypeOf("number");
      expect(body).toMatch(/##\s*Direct answer/i);
    }
  });

  it("medical emergency script: direct answer references 911", () => {
    const raw = readFileSync(
      join(SCRIPTS, "medical-emergency-disguised-as-question.md"),
      "utf8",
    );
    const p = parseEscalationMarkdown(raw, "acute_medical", "not responding", { crName: "Mom" });
    expect(p.directAnswer.toLowerCase()).toMatch(/911/);
  });
});
