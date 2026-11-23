import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Resolves the monorepo root (directory containing `pnpm-workspace.yaml`).
 * Falls back to `process.cwd()` when not found (e.g. mis-deployed layout).
 */
export function monorepoRootFromCwd(): string {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
