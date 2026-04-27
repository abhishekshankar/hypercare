#!/usr/bin/env node
/**
 * After `next build`, scan *client* static assets for strings that would indicate
 * `@alongside/rag` (or the Bedrock client) was bundled for the browser. ESLint is
 * the day-to-day gate; this is a quick sanity check on compiled output.
 *
 *   pnpm --filter web run build
 *   pnpm --filter web exec node scripts/verify-client-bundle.mjs
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const staticDir = join(webRoot, ".next/static");

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(p)));
    } else if (e.isFile() && e.name.endsWith(".js")) {
      out.push(p);
    }
  }
  return out;
}

async function main() {
  try {
    await stat(staticDir);
  } catch {
    console.error("Missing .next/static — run `pnpm --filter web build` first.");
    process.exit(1);
  }
  const files = await walk(staticDir);
  const needles = [
    ["@alongside/rag", "workspace RAG in client static bundle"],
    ["@aws-sdk/client-bedrock-runtime", "Bedrock client in client static bundle"],
  ];
  for (const f of files) {
    const body = await readFile(f, "utf8");
    for (const [n, why] of needles) {
      if (body.includes(n)) {
        console.error(`FAIL: ${why}\n  matched: ${n}\n  file: ${f}`);
        process.exit(1);
      }
    }
  }
  console.log(
    `OK: no banned substrings in ${String(files.length)} client JS file(s) under .next/static`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
