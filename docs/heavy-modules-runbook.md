# Heavy modules (Hermes) — operator runbook

## Environment variables required

| Variable | Used by | Role |
|----------|---------|------|
| **`DATABASE_URL`** | `pnpm --filter @alongside/db migrate` (`packages/db/src/migrate.ts`) | Drizzle migrator connects with this URL. |
| **`DATABASE_URL_ADMIN`** | `pnpm --filter @alongside/content load` (flat or **`--heavy`**) (`packages/content/src/cli.ts`) | Content loader / heavy publish path. |

In local dev through the SSM tunnel, **both often point at the same Postgres URL** (for example `postgresql://hypercare_admin:…@127.0.0.1:15432/hypercare_dev`). They are still **two distinct environment variables** by code-path contract—migrate never reads `DATABASE_URL_ADMIN`, and the content CLI does not read `DATABASE_URL` for heavy ingest.

Canonical commented definitions live in **`.env.example`** at the repo root (TASK-003 for `DATABASE_URL`, TASK-044 for `DATABASE_URL_ADMIN`). Tunnel and secret handling: **`docs/infra-runbook.md`**.

---

## Operator checklist (migrate → build → ingest → dev)

Run from the **monorepo root** on the machine where the DB tunnel runs (`127.0.0.1:15432` must reach Aurora).

1. **Start the DB tunnel** — No app env vars for the tunnel script itself. See **`docs/infra-runbook.md`** (SSM port forward, `./scripts/db-tunnel.sh`).

2. **`pnpm install`** — **Env:** none. Run after clone or lockfile changes.

3. **Apply migrations** — **Env:** **`DATABASE_URL`** must be exported (or present in the shell environment).  
   ```bash
   pnpm --filter @alongside/db migrate
   ```  
   Confirm migration **`0023_heavy_modules`** (or equivalent) is applied (Drizzle journal / `psql` smoke).

4. **Build the content package** — **Env:** none. Produces a fresh **`packages/content/dist/`** for the loader and avoids stale types vs `src/`.  
   ```bash
   pnpm --filter @alongside/content build
   ```

5. **(Optional) Heavy dry-run** — **Env:** **`DATABASE_URL_ADMIN`**. Validates the bundle against the DB without writing. Relation targets must already exist in **`modules`** (dry-run does not apply **`--seed-relation-targets`**); if validation fails on missing targets, skip to step 6 or seed those modules first.  
   ```bash
   pnpm --filter @alongside/content load -- --heavy --dry-run transitions-first-two-weeks
   ```  
   Prints JSON with `errors` / `warnings`; non-zero exit if `errors` are present.

6. **Publish heavy module to Postgres** — **Env:** **`DATABASE_URL_ADMIN`**. Use **`--seed-relation-targets`** when related target slugs are not in `modules` yet (dev/staging only; inserts stubs so FKs on relations pass).  
   ```bash
   pnpm --filter @alongside/content load -- --heavy --seed-relation-targets transitions-first-two-weeks
   ```

7. **(Optional) SQL smoke** — Same DB as the tunnel; use your admin or app URL in `psql`. Example checks after ingesting `transitions-first-two-weeks`:  
   `SELECT slug, heavy, bundle_version FROM modules WHERE slug = 'transitions-first-two-weeks';`  
   `SELECT count(*) FROM module_branches WHERE module_id = (SELECT id FROM modules WHERE slug = 'transitions-first-two-weeks');`  
   `SELECT count(*) FROM module_evidence WHERE module_id = (SELECT id FROM modules WHERE slug = 'transitions-first-two-weeks');`

8. **Run the web app locally** — **Env:** **`apps/web/.env.local`** for Cognito and session (see **`.env.example`** pointers and **`docs/auth-contract.md`**). The Next server also needs a working **`DATABASE_URL`** (or project-specific equivalent) for server routes that hit Postgres—see **CLAUDE.md** hosting-vs-local notes; do not conflate with `DATABASE_URL_ADMIN`.  
   ```bash
   pnpm --filter web dev
   ```  
   Then open the app (e.g. `http://localhost:3000`), sign in, set care profile as needed, and navigate to **`/app/modules/<slug>`**.

Internal HTTP path (content-lead roles): **`POST /api/internal/content/publish-bundle`** with the same JSON shape as `parseHeavyPublishBundle` (see `@alongside/content`).

### Validator: composite first-person

Inside **`<!-- provenance: composite -->`** blocks, publish **errors** only on **first-person after an opening quote** (`"I`, `'I`, etc.). Plain `, I` / `; I` in running prose is intentionally **not** flagged — it false-positived on legitimate scripted quotes (*e.g.* `Tuesday, I realized` inside dialogue). Hermes **Critique** (`hermes/prompts/08-critique.md`) still enforces lived-experience voice in the rubric.

---

## Troubleshooting: pnpm hoists / missing `tsc`, `tsx`, or stale types

**Symptom:** `Cannot find module '…/typescript/bin/tsc'`, **`Cannot find module '…/tsx/dist/cli.mjs'`**, Vitest bin missing under a package, or **`Module '"@alongside/content"' has no exported member '…'`** in `apps/web` after changing `@alongside/content` source.

**Fix:**

1. **`@alongside/db` and `@alongside/content`** package scripts invoke repo-root **`node_modules/typescript`**, **`node_modules/tsx`**, etc., via explicit `node ../../node_modules/...` paths so **`node-linker=hoisted`** (see repo **`.npmrc`**) resolves consistently—if you see a broken `tsx` symlink under a package, prefer **`pnpm install`** from the repo root, then re-run the command from the checklist.
2. Run **`pnpm --filter @alongside/content build`** (or `pnpm exec tsc -p packages/content/tsconfig.json`) so **`packages/content/dist/**`** matches `src/`.
3. If **`apps/web`** typecheck still fails, remove a corrupted **`apps/web/.next`** (duplicate `*.d 2.ts` files from a bad merge can break `tsc`) and rebuild web if you rely on `.next/types` locally.
4. Prefer running **`pnpm lint`**, **`pnpm typecheck`**, and **`pnpm test`** from the **repo root** so workspace scripts resolve `node_modules` consistently.

Package scripts in this repo call repo-root **`node_modules/typescript`**, **`vitest`**, **`eslint`**, and **`next`** where needed so hoisted installs work on CI and developer machines.
