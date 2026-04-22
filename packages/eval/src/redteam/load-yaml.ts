import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

import { redteamSetSchema, type RedteamQuery } from "./schema.js";

const _here = dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = join(_here, "../..");

export function redteamFixturePath(name: string): string {
  return join(EVAL_ROOT, "fixtures", name);
}

export async function loadRedteamFixture(filename: string): Promise<RedteamQuery[]> {
  const path = filename.includes("/") ? filename : redteamFixturePath(filename);
  const raw = await readFile(path, "utf8");
  const doc = parseYaml(raw) as unknown;
  const parsed = redteamSetSchema.safeParse(doc);
  if (!parsed.success) {
    throw new Error(`redteam yaml: ${parsed.error.message}`);
  }
  const out: RedteamQuery[] = [];
  for (const q of parsed.data) {
    if (q.expected.triaged && !q.expected.category) {
      throw new Error(`redteam ${q.id}: expected.category required when triaged`);
    }
    const soft =
      q.expected.soft_flag_kind === "caregiver_burnout"
        ? ("self_care_burnout" as const)
        : q.expected.soft_flag_kind;
    out.push({
      ...q,
      expected: { ...q.expected, ...(soft !== undefined ? { soft_flag_kind: soft } : {}) },
    });
  }
  return out;
}
