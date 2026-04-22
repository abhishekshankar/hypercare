# Architecture (deltas)

High-level product and stack context stay in `PROJECT_BRIEF.md` and `prd.md`. This file captures a **route map** and one **import boundary** that are easy to break by accident.

## Authed app routes (`apps/web`, `(authed)` group)

| Path | Role |
|------|------|
| `/` | Marketing / landing |
| `/app` | Home: greeting, starter chips, recent conversations, ask flow |
| `/app/conversation/[id]` | Thread + composer; loads prior `messages` |
| `/app/modules/[slug]` | Module stub (v0) |
| `/app/lesson/[slug]` | Lesson |
| `/app/library` | Library |
| `/app/profile` | Profile |
| `/onboarding/*` | Onboarding wizard |
| `/help` | Help (public) |

## App API (browser → server, session required)

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/app/conversation/start` | Create `conversations` row; client redirects to thread |
| `GET` | `/api/app/conversation/[id]` | JSON thread (messages) for reload / tests |
| `POST` | `/api/app/conversation/[id]/message` | User turn + `rag.answer()` + persist assistant turn |

## Import boundary: browser never loads `@hypercare/rag`

All RAG and safety orchestration run on the **server** (Route Handlers and `server-only` helpers). The browser must not import `@hypercare/rag` or call Bedrock-capable code; that keeps keys and heavy deps out of the client bundle. ADR 0010 is the full rationale.

## Schema note (TASK-011)

`messages` carries `citations` and `refusal` as **jsonb** (see `packages/db` migrations). Application code treats them as `Citation[]` and optional refusal payloads at the type layer; see ADR 0010 §7.
