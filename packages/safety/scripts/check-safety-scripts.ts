/**
 * Fails if expert escalation script bodies change without a matching `reviewed_on`
 * bump. See ADR 0015.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";

const _root = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(_root, "../src/scripts");
const MANIFEST_PATH = join(SCRIPTS_DIR, ".review-manifest.json");

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

type ManifestEntry = { reviewed_on: string; body_sha256: string };
type Manifest = Record<string, ManifestEntry>;

function bodyHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function parseFile(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const m = raw.match(FRONTMATTER);
  if (!m) {
    throw new Error("Missing YAML frontmatter (--- delimiters).");
  }
  const data = (loadYaml(m[1] ?? "", {}) as Record<string, unknown>) ?? {};
  return { frontmatter: data, body: m[2] ?? "" };
}

/** Full days from `a` to `b` (non-negative). */
function daysFrom(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

type ErrorList = string[];

function validateFile(name: string, raw: string, errs: ErrorList): { entry: ManifestEntry } | null {
  const before = errs.length;
  const { frontmatter, body } = parseFile(raw);
  const version = frontmatter.version;
  const reviewedBy = frontmatter.reviewed_by;
  const reviewedOn = frontmatter.reviewed_on;
  const nextReview = frontmatter.next_review_due;

  if (typeof version !== "number" || version < 1) {
    errs.push(`${name}: frontmatter "version" must be a positive number.`);
  }
  if (typeof reviewedBy !== "string" || reviewedBy.trim() === "") {
    errs.push(`${name}: "reviewed_by" must be a non-empty string.`);
  }
  if (typeof reviewedOn !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(reviewedOn)) {
    errs.push(`${name}: "reviewed_on" must be a YYYY-MM-DD date.`);
  }
  if (typeof nextReview === "string" && typeof reviewedOn === "string") {
    const dOn = new Date(reviewedOn);
    const dNext = new Date(nextReview);
    if (Number.isFinite(dOn.getTime()) && Number.isFinite(dNext.getTime()) && daysFrom(dOn, dNext) < 90) {
      errs.push(
        `${name}: "next_review_due" must be at least 90 days after "reviewed_on" (quarterly review).`,
      );
    }
  }

  if (errs.length > before) return null;
  return {
    entry: {
      reviewed_on: String(reviewedOn),
      body_sha256: bodyHash(body),
    },
  };
}

function main() {
  const files = readdirSync(SCRIPTS_DIR).filter(
    (f) => f.endsWith(".md") && !f.startsWith("_") && f !== "README.md",
  );
  if (files.length === 0) {
    console.error("No script .md files found.");
    process.exit(1);
  }

  const errs: string[] = [];
  let priorManifest: Manifest = {};
  try {
    priorManifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  } catch {
    // first run
  }

  const nextManifest: Manifest = {};

  for (const f of files.sort()) {
    const raw = readFileSync(join(SCRIPTS_DIR, f), "utf8");
    const r = validateFile(f, raw, errs);
    if (!r) continue;

    const prev = priorManifest[f];
    if (prev) {
      if (prev.body_sha256 !== r.entry.body_sha256 && prev.reviewed_on === r.entry.reviewed_on) {
        errs.push(
          `${f}: body changed but "reviewed_on" was not updated (expected manifest bump for expert re-review).`,
        );
        continue;
      }
    }
    nextManifest[f] = r.entry;
  }

  if (errs.length) {
    for (const e of errs) {
      console.error(e);
    }
    process.exit(1);
  }

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
  console.info(`check-safety-scripts: OK (${files.length} files, manifest written).`);
}

main();
