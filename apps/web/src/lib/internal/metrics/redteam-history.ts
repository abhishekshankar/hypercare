import "server-only";

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Parse `packages/eval/artifacts/redteam-v2-history.jsonl` for the safety metrics sparkline (TASK-035). */
export async function loadRedteamSpark(): Promise<Array<{ week: string; rate: number | null }>> {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, "..", "..", "..", "..", "..", "..", "..");
  const p = join(repoRoot, "packages/eval/artifacts/redteam-v2-history.jsonl");
  let raw: string;
  try {
    raw = await readFile(p, "utf8");
  } catch {
    return [];
  }
  const lines = raw
    .trim()
    .split("\n")
    .filter(Boolean);
  const out: Array<{ week: string; rate: number | null }> = [];
  for (const line of lines) {
    try {
      const j = JSON.parse(line) as { run_at?: string; overall?: number };
      if (j.run_at != null && typeof j.overall === "number") {
        out.push({
          week: j.run_at.slice(0, 10),
          rate: j.overall <= 1 ? j.overall * 100 : j.overall,
        });
      }
    } catch {
      // skip bad line
    }
  }
  return out.slice(-12);
}
