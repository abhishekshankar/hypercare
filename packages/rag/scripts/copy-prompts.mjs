// Post-build copy of prompt templates so the published `dist/` mirrors `src/prompts/`.
// Layer 4 reads prompts from `<here>/../prompts/*.md` at module load.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src/prompts");
const dst = resolve(here, "../dist/prompts");

if (!existsSync(src)) {
  console.error(`copy-prompts: source dir missing: ${src}`);
  process.exit(1);
}

mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log(`copy-prompts: copied ${src} -> ${dst}`);

const memSrc = resolve(here, "../src/memory");
const memDst = resolve(here, "../dist/memory");
if (existsSync(memSrc)) {
  mkdirSync(memDst, { recursive: true });
  cpSync(memSrc, memDst, { recursive: true });
  console.log(`copy-prompts: copied ${memSrc} -> ${memDst}`);
}
