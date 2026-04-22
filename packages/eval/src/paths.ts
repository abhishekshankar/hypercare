import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** `packages/eval` root (contains `golden/`, `reports/`). `here` is `.../eval/src`. */
export const EVAL_ROOT = join(here, "..");

export function goldenPath(name: "retrieval.json" | "safety.json" | "answers.json"): string {
  return join(EVAL_ROOT, "golden", name);
}

export function reportDirForRunner(runner: "retrieval" | "safety" | "answers"): string {
  return join(EVAL_ROOT, "reports", runner);
}

export function reportLatestPath(runner: "retrieval" | "safety" | "answers"): string {
  return join(reportDirForRunner(runner), "latest.json");
}
