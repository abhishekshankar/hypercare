import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getTableName, isTable } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import * as schema from "../src/schema/index.js";

/**
 * TASK-043 — every Drizzle-known public table must be documented in at least one
 * `docs/schema-v*.md`. Catches "we shipped a table but forgot to document it"
 * (the Sprint 4 `safety_flags` footgun). The check is permissive: a table is
 * considered documented if its SQL name appears either as a heading word or as
 * a backticked mention anywhere in the joined schema docs.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, "..", "..", "..", "docs");
const SCHEMA_DOC_FILES = ["schema-v0.md", "schema-v1.md", "schema-v2.md"];

const schemaDocs: { name: string; text: string }[] = SCHEMA_DOC_FILES.map((file) => ({
  name: file,
  text: readFileSync(join(docsDir, file), "utf8"),
}));

const joinedDocText = schemaDocs.map((d) => d.text).join("\n\n");

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDocumented(tableName: string): boolean {
  const escaped = escapeRegex(tableName);
  // Heading line containing the table name as a whole word (handles markdown table cells too).
  const headingOrTableRowRe = new RegExp(`(^#{1,6}\\s+.*\\b${escaped}\\b)|(^\\|.*\\b${escaped}\\b.*\\|)`, "m");
  // Backticked mention `name` anywhere in the doc body.
  const backtickRe = new RegExp("`" + escaped + "`");
  return headingOrTableRowRe.test(joinedDocText) || backtickRe.test(joinedDocText);
}

const drizzleTables = Object.entries(schema)
  .filter(([, value]) => isTable(value))
  .map(([exportName, value]) => ({
    exportName,
    sqlName: getTableName(value as never),
  }));

describe("schema-doc-coverage (TASK-043)", () => {
  it("Drizzle exports at least 30 tables (sanity floor)", () => {
    expect(drizzleTables.length).toBeGreaterThanOrEqual(30);
  });

  it("all three schema docs are readable", () => {
    for (const doc of schemaDocs) {
      expect(doc.text.length, `${doc.name} should not be empty`).toBeGreaterThan(0);
    }
  });

  it.each(drizzleTables.map((t) => [t.sqlName, t.exportName]))(
    'public table "%s" (export %s) is documented in docs/schema-v*.md',
    (sqlName) => {
      expect(
        isDocumented(sqlName),
        `Table "${sqlName}" is referenced by Drizzle but not documented in any of: ${SCHEMA_DOC_FILES.join(", ")}. ` +
          `Add a section to docs/schema-v2.md per CONTRIBUTING.md "Schema deltas (TASK-043)".`,
      ).toBe(true);
    },
  );
});
