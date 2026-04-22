# Agent / developer notes

## Database

- After pulling: `pnpm --filter @hypercare/db migrate` — never reset the DB; apply new migrations only.
- **TASK-041:** migration `0020_library_search_streams.sql` creates telemetry for library SSE search (counts and latency only; no query text).
- **Stage v1 data migration:** `pnpm --filter @hypercare/content migrate:stage-v1` (was `@hypercare/db`; script lives in `packages/content` so `@hypercare/db` can build before `@hypercare/content`).

## Web app (`apps/web`)

### Streaming feature flags (per-surface rollback)

| Surface              | Server env                     | Client env (`NEXT_PUBLIC_*`)      | Notes |
|----------------------|--------------------------------|-----------------------------------|--------|
| Conversation answers | `STREAMING_ANSWERS`            | `NEXT_PUBLIC_STREAMING_ANSWERS`   | ADR 0020 |
| Lessons              | `STREAMING_LESSONS`           | `NEXT_PUBLIC_STREAMING_LESSONS`   | TASK-040, ADR 0029 |
| Library search       | `STREAMING_LIBRARY`            | `NEXT_PUBLIC_STREAMING_LIBRARY`   | TASK-041, ADR 0029 |

Library: both must be `1` or `true` for SSE. Route is `POST /api/app/library/search` with `Accept: text/event-stream`. Server-only flag off → **404**; client falls back to client-side filtering.

Conversation messages: `POST /api/app/conversation/[id]/message` reads `users.routing_cohort` for Layer-5 routing when `MODEL_ROUTING=1`. Unit tests that invoke this route without Postgres mock `@hypercare/db` `createDbClient` and partially mock `@/lib/env.server` (see `test/safety/conversation-escalation.test.ts`).

### Amplify Hosting (build succeeds, site is 404)

If `curl -sI https://<branch>.<appId>.amplifyapp.com/` shows **404** and **`server: AmazonS3`**, Amplify deployed the `.next` folder as a **static** site (platform **WEB**). This app needs **SSR + API routes** (platform **WEB_COMPUTE**, framework **Next.js - SSR**). S3 cannot run Next.js, so there is no document at `/`.

**Monorepo env:** Hosting → **Environment variables** → `AMPLIFY_MONOREPO_APP_ROOT=apps/web` (all branches), matching `appRoot` in root `amplify.yml`.

**Platform / framework:** For many existing apps, the console **General → Edit** page does **not** expose Platform or Framework dropdowns; set them with the CLI (use the app’s region and account). **Platform** is **app**-level; **framework** is **branch**-level.

```bash
aws amplify update-app     --app-id <appId> --platform WEB_COMPUTE --region <region>
aws amplify update-branch  --app-id <appId> --branch-name main --framework "Next.js - SSR" --region <region>
```

Then **redeploy** the branch (new build). Example production app: `ca-central-1`, app id `d1ajzemw7s1n5f`.

If platform/framework/env are already correct but the URL **still** returns **`server: AmazonS3`** on `/`, align the **monorepo build spec** with [AWS monorepo Hosting](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html): root `amplify.yml` uses `frontend.buildPath: /`, phases run `pnpm install` / `pnpm --filter web... run build` from the repo root, and `artifacts.baseDirectory` is **`apps/web/.next`** (relative to `/`, not `.next` alone). Repo root **`.npmrc`** sets `node-linker=hoisted` (required for pnpm on Amplify). **`apps/web/next.config.ts`** sets `output: 'standalone'` and `outputFileTracingRoot` to the repo root so compute can trace `packages/*` workspace deps.

**500 on every route (including `/`):** Two distinct causes, distinguish by response headers.

1. **`x-cache: Error from cloudfront`, no `server:` header** → CloudFront has no reachable origin. Amplify did not provision an SSR compute function for the branch. Cause: the deploy artifact at `apps/web/.next/` is missing the manifests Amplify reads to detect a Next.js SSR app — `BUILD_ID`, `required-server-files.json`, `routes-manifest.json`, `prerender-manifest.json`, plus `app-*-manifest.json` / `build-manifest.json`. Build and deploy still report SUCCEED (nothing throws); detection fails silently. Fix: include those at the artifact root in `amplify.yml` (current spec ships `BUILD_ID`, `*.json`, `standalone/**/*`, `static/**/*`; `postBuild` has a guard that fails the build if those manifests aren't where expected).

2. **5xx with a `server:` header that names the origin** → SSR Lambda is reachable but throwing. Most common cause is `apps/web/src/instrumentation.ts` eagerly importing `env.server` in production with missing/invalid Hosting → Environment variables (Zod throws at process boot). See `docs/auth-runbook.md` § *Amplify: “Internal Server Error” on every page* and mirror `apps/web/.env.local` keys into Amplify (plus CloudWatch for the thrown message).

**Deploy: “build output exceeds max allowed size” (~220MB):** Two distinct bloat sources, both observed; fix is layered.

1. **`.next/cache` (Next webpack/turbopack cache).** With `output: 'standalone'`, Next still leaves `.next/cache` at the app root and copies it again under `.next/standalone/.../.next/cache` (~150–200MB combined). Cache is build-only; safe to delete before artifact collection. Root `amplify.yml` `postBuild` does `rm -rf apps/web/.next/cache apps/web/.next/standalone/apps/web/.next/cache`.

2. **Duplicate server tree from shipping the full `.next/`.** `output: 'standalone'` writes a self-contained server bundle under `.next/standalone/` (with traced `packages/*` workspace deps, since `outputFileTracingRoot` is the repo root). `.next/server/` already contains the same compiled server. Uploading `apps/web/.next/**/*` ships both copies — observed at **440MB after cache cleanup**, well over the ~220MB limit. Fix: narrow `artifacts.files` to `standalone/**/*` and `static/**/*` only. The SSR runner only needs the standalone tree (entry point) and the static client chunks; `.next/server` is redundant once standalone exists.

The current `amplify.yml` does both. The `postBuild` also prints per-subtree `du -sh` (`.next`, `.next/server`, `.next/static`, `.next/standalone`) bracketed by `=== postBuild start/done ===` markers — if the next size failure happens, those lines tell you which subtree grew. If you don't see them in the build log, `postBuild` didn't run; check the Amplify console for a phase-level error before debugging size.

**If deploy succeeds but `/_next/static/chunks/...` 404:** the compute bundle may not be laying out `static/` where the standalone `server.js` expects it. **Option B** is to align paths (e.g. ensure `.next/static` ends up as `standalone/apps/web/.next/static` relative to the process cwd, or follow AWS Next SSR + standalone layout docs for your image). Confirm with a real deploy first — Option A is the smaller diff.

## Product / architecture pointers

- `PROJECT_BRIEF.md`, `prd.md`, root `README.md`, `ARCHITECTURE.md`
- Streaming lessons + library: `docs/adr/0029-streaming-lessons-and-library.md`
