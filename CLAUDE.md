# Agent / developer notes

## Database

- After pulling: `pnpm --filter @hypercare/db migrate` — never reset the DB; apply new migrations only.
- **TASK-041:** migration `0020_library_search_streams.sql` creates telemetry for library SSE search (counts and latency only; no query text).

## Web app (`apps/web`)

### Streaming feature flags (per-surface rollback)

| Surface              | Server env                     | Client env (`NEXT_PUBLIC_*`)      | Notes |
|----------------------|--------------------------------|-----------------------------------|--------|
| Conversation answers | `STREAMING_ANSWERS`            | `NEXT_PUBLIC_STREAMING_ANSWERS`   | ADR 0020 |
| Lessons              | `STREAMING_LESSONS`           | `NEXT_PUBLIC_STREAMING_LESSONS`   | TASK-040, ADR 0029 |
| Library search       | `STREAMING_LIBRARY`            | `NEXT_PUBLIC_STREAMING_LIBRARY`   | TASK-041, ADR 0029 |

Library: both must be `1` or `true` for SSE. Route is `POST /api/app/library/search` with `Accept: text/event-stream`. Server-only flag off → **404**; client falls back to client-side filtering.

Conversation messages: `POST /api/app/conversation/[id]/message` reads `users.routing_cohort` for Layer-5 routing when `MODEL_ROUTING=1`. Unit tests that invoke this route without Postgres mock `@hypercare/db` `createDbClient` and partially mock `@/lib/env.server` (see `test/safety/conversation-escalation.test.ts`).

## Product / architecture pointers

- `PROJECT_BRIEF.md`, `prd.md`, root `README.md`, `ARCHITECTURE.md`
- Streaming lessons + library: `docs/adr/0029-streaming-lessons-and-library.md`
