import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { EVAL_ROOT } from "../paths.js";

/** Fingerprint of committed escalation MD bodies (TASK-035 weekly red-team history). */
export function escalationScriptsContentHash(): string {
  const dir = join(EVAL_ROOT, "../safety/src/scripts");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort();
  const h = createHash("sha256");
  for (const f of files) {
    h.update(f);
    h.update("\0");
    h.update(readFileSync(join(dir, f), "utf8"));
  }
  return h.digest("hex").slice(0, 16);
}
