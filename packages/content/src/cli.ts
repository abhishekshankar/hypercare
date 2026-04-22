import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { chunkModuleBody } from "./chunk.js";
import { parseModuleFile } from "./parse.js";
import { loadExistingChunkMap, resolveEmbeddings, upsertModuleWithChunks } from "./upsert.js";

const adminUrlSchema = z
  .string()
  .min(1, "DATABASE_URL_ADMIN is required")
  .refine(
    (u) => u.startsWith("postgres://") || u.startsWith("postgresql://"),
    "DATABASE_URL_ADMIN must start with postgres:// or postgresql://",
  );

/**
 * Admin URL for the operator-only content loader (migrations, seeding). Paste the
 * connection string after opening `./scripts/db-tunnel.sh` and reading the
 * `password` field (only) from the CDK `SecretArn` in Secrets Manager — see `docs/infra-runbook.md`.
 */
export function requireDatabaseUrlAdmin(): string {
  const raw = process.env.DATABASE_URL_ADMIN;
  const parsed = adminUrlSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = [
      "DATABASE_URL_ADMIN is not set or invalid.",
      "Set it to a postgres URL (e.g. postgresql://hypercare_admin:…@127.0.0.1:15432/hypercare_dev) after",
      "starting the SSM tunnel: ./scripts/db-tunnel.sh",
      "Use the `password` from the cluster secret in AWS Secrets Manager (do not log or commit it).",
    ].join(" ");
    console.error(msg);
    process.exit(1);
  }
  return parsed.data;
}

/**
 * Resolves the markdown directory: `CONTENT_MODULES_DIR` or `repoRoot/content/modules` when the CLI is run from repo root.
 */
export function resolveModulesDir(cwd: string, env = process.env): string {
  if (env.CONTENT_MODULES_DIR) {
    return path.resolve(cwd, env.CONTENT_MODULES_DIR);
  }
  return path.resolve(cwd, "content", "modules");
}

async function listModuleFiles(dir: string): Promise<string[]> {
  const names = await readdir(dir, { withFileTypes: true });
  return names
    .filter((d) => d.isFile() && d.name.endsWith(".md"))
    .map((d) => path.join(dir, d.name))
    .sort();
}

export async function runLoad(
  options: { cwd?: string; databaseUrl?: string; modulesDir?: string } = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const databaseUrl = options.databaseUrl ?? requireDatabaseUrlAdmin();
  const dir = options.modulesDir ?? resolveModulesDir(cwd);
  const files = await listModuleFiles(dir);
  if (files.length === 0) {
    console.error(`No .md files under ${dir}. Create content/modules/*.md (see tasks/TASK-008).`);
    process.exit(1);
  }
  for (const file of files) {
    const parsed = await parseModuleFile(file);
    const chunks = chunkModuleBody(parsed.body);
    const { byIndex } = await loadExistingChunkMap(databaseUrl, parsed.front.slug);
    const logSkip = (n: number) => {
      console.log(`skip ${parsed.front.slug} chunk ${String(n)} (hash match)`);
    };
    const embeddings = await resolveEmbeddings(byIndex, { front: parsed.front, body: parsed.body, chunks }, logSkip);
    const res = await upsertModuleWithChunks(databaseUrl, { front: parsed.front, body: parsed.body, chunks }, embeddings);
    console.log(`ok ${parsed.front.slug}: ${String(res.chunkCount)} chunks`);
  }
}

const isMain =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  void runLoad();
}
