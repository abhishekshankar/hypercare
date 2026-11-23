import "server-only";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

import { serverEnv } from "../../env.server";

const _dir = dirname(fileURLToPath(import.meta.url));

let _client: ReturnType<typeof postgres> | undefined;

function sqlc(): ReturnType<typeof postgres> {
  if (_client === undefined) {
    _client = postgres(serverEnv.DATABASE_URL, { max: 2, prepare: false });
  }
  return _client;
}

export function loadSql(name: string): string {
  return readFileSync(join(_dir, "sql", `${name}.sql`), "utf8");
}

/** Execute a `.sql` file from `./sql/`. Use `$1`, `$2`, … in the file. */
export async function runSqlFile<T extends Record<string, unknown>>(
  name: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const text = loadSql(name).trim();
  const c = sqlc();
  if (params.length === 0) {
    return c.unsafe(text) as Promise<T[]>;
  }
  return c.unsafe(text, [...params] as never) as Promise<T[]>;
}
