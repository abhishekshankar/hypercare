// Post-build copy of the LLM classifier prompt so the published `dist/`
// mirrors `src/prompts/`. `llm/classifier.ts` reads it relative to its own URL.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src/prompts");
const dst = resolve(here, "../dist/prompts");

if (!existsSync(src)) {
  console.error(`safety/copy-prompts: source dir missing: ${src}`);
  process.exit(1);
}

mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log(`safety/copy-prompts: copied ${src} -> ${dst}`);
