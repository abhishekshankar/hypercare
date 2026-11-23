import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiAppDir = join(webRoot, "src/app/api/app");

/**
 * Every `/api/app/**` Route Handler must call `getSession()` (by that name) and return
 * 401 when null — not `requireSession()` (that redirects, wrong for JSON APIs). This
 * test matches the literal `getSession(` in source; a handler that only calls
 * `getSession` via an alias (`import { getSession as gs }`) or a helper would not
 * match — if you add that pattern, extend this audit.
 */
async function collectRouteFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      out.push(...(await collectRouteFiles(p)));
    } else if (name.name === "route.ts" || name.name === "route.js") {
      out.push(p);
    }
  }
  return out;
}

it("every apps/web api/app route handler uses getSession", async () => {
  const files = await collectRouteFiles(apiAppDir);
  expect(
    files.length,
    "expected at least one route under src/app/api/app; update this test if the tree is empty",
  ).toBeGreaterThan(0);

  for (const f of files) {
    const src = await readFile(f, "utf8");
    expect(
      /getSession\s*\(/.test(src) || /getSession\s*</.test(src),
      `${f} must call getSession() so unauthenticated requests get 401`,
    ).toBe(true);
  }
});
