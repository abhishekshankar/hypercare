import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Loads checked-in prompt templates next to this file.
 * `import.meta.url` resolves to either `src/prompts/loader.ts` (vitest, tsx)
 * or `dist/prompts/loader.js` after build — both contain the .md siblings
 * (the build step `scripts/copy-prompts.mjs` copies them into `dist/prompts`).
 */
const here = dirname(fileURLToPath(import.meta.url));

function readPrompt(name: string): string {
  const p = resolve(here, name);
  return readFileSync(p, "utf8");
}

export const SYSTEM_PROMPT = readPrompt("system.md");
export const USER_TEMPLATE = readPrompt("user-template.md");
