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

## Product / architecture pointers

- `PROJECT_BRIEF.md`, `prd.md`, root `README.md`, `ARCHITECTURE.md`
- Streaming lessons + library: `docs/adr/0029-streaming-lessons-and-library.md`
