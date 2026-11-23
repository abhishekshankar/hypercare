// Standalone env-var validator for hypercare.
// Mirrors the Zod schema in apps/web/src/lib/env.server.ts (required fields only)
// but skips the `import "server-only"` guard so it runs under plain Node.
//
// Usage (from your Mac, at the repo root):
//   node check-env.mjs
//
// Reads apps/web/.env.local. Prints a per-field report with byte counts so
// leading/trailing whitespace can be spotted.

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// --- tiny .env parser (avoids needing to install dotenv) ---
function parseEnvFile(path) {
  if (!existsSync(path)) {
    console.error(`Cannot find env file: ${path}`);
    console.error(`   Run this script from the repo root (where apps/web lives).`);
    process.exit(2);
  }
  const text = readFileSync(path, "utf8");
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const envPath = resolve(process.cwd(), "apps/web/.env.local");
const env = parseEnvFile(envPath);

const byteLen = (s) => new TextEncoder().encode(s).length;
const isUrl = (s) => /^https?:\/\//.test(s);
const isPostgres = (s) => /^postgres(ql)?:\/\//i.test(s);

const checks = [
  { key: "COGNITO_USER_POOL_ID", validate: (v) => v.length > 0 || "must be non-empty" },
  { key: "COGNITO_APP_CLIENT_ID", validate: (v) => v.length > 0 || "must be non-empty" },
  { key: "COGNITO_APP_CLIENT_SECRET", validate: (v) => byteLen(v) >= 1 || "must be >=1 byte" },
  { key: "COGNITO_DOMAIN", validate: (v) => isUrl(v) || "must be a full URL (https://... or http://...)" },
  { key: "COGNITO_REGION", validate: (v) => v.length > 0 || "must be non-empty" },
  { key: "AUTH_BASE_URL", validate: (v) => isUrl(v) || "must be a full URL (no path-only value)" },
  { key: "AUTH_SIGNOUT_URL", validate: (v) => isUrl(v) || "must be a full URL" },
  { key: "SESSION_COOKIE_SECRET", validate: (v) => byteLen(v) >= 32 || `must be >=32 bytes (got ${byteLen(v)})` },
  { key: "DATABASE_URL", validate: (v) => isPostgres(v.trim()) || "must be postgres:// or postgresql:// URL" },
];

console.log(`Reading ${envPath}`);
console.log(`Found ${Object.keys(env).length} total vars in file.`);
console.log("");

let failed = 0;
let warnings = 0;

for (const { key, validate } of checks) {
  const raw = env[key];

  if (raw === undefined) {
    console.log(`FAIL ${key}: MISSING`);
    failed++;
    continue;
  }

  const trimmed = raw.trim();
  const hasOuterWhitespace = raw !== trimmed;
  const result = validate(raw);

  if (result === true) {
    const whitespaceNote = hasOuterWhitespace
      ? `  WARN LEADING/TRAILING WHITESPACE (raw=${raw.length} chars, trimmed=${trimmed.length})`
      : "";
    const hint =
      key.includes("URL") || key === "COGNITO_DOMAIN"
        ? ` [${raw.slice(0, 12)}...]`
        : "";
    console.log(`OK   ${key}: ${byteLen(raw)} bytes${hint}${whitespaceNote}`);
    if (hasOuterWhitespace) warnings++;
  } else {
    console.log(`FAIL ${key}: ${result}`);
    if (hasOuterWhitespace) {
      console.log(`    (note: has leading/trailing whitespace - raw=${raw.length}, trimmed=${trimmed.length})`);
    }
    failed++;
  }
}

console.log("");
if (failed > 0) {
  console.log(`${failed} field(s) failed. Fix apps/web/.env.local, then re-run.`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`All fields pass, but ${warnings} have leading/trailing whitespace.`);
  process.exit(0);
} else {
  console.log(`All required fields pass validation with clean values.`);
  process.exit(0);
}
EOF


EOF
