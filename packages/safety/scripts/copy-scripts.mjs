// Post-build copy of escalation markdown + manifest so `dist/scripts/` can be read at runtime.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src/scripts");
const dst = resolve(here, "../dist/scripts");

if (!existsSync(src)) {
  console.error(`safety/copy-scripts: source dir missing: ${src}`);
  process.exit(1);
}

mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log(`safety/copy-scripts: copied ${src} -> ${dst}`);
