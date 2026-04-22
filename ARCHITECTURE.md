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
| `POST` `GET` | `/api/app/this-weeks-focus` | Run `pickThisWeeksFocus` (TASK-024) |
| `POST` | `/api/app/lesson/[slug]/start` | Insert `lesson_progress` row, return `progressId` |
| `POST` | `/api/app/lesson/[slug]/complete` | Set `completed_at` + `revisit` on `lesson_progress` |
| `POST` | `/api/app/checkin` | Answer weekly check-in (`tried_something`, optional `what_helped`) |
| `POST` | `/api/app/checkin/skip` | Stamp `prompted_at` only (skipped) |
| `GET` | `/api/app/checkin/should-show` | Cadence + soft-flag elevation for the home card |

Unauthenticated calls to these handlers return **401** JSON (session middleware does not redirect `/api/app/*` to the login page so `fetch` and tests see a proper status).

## Import boundary: browser never loads `@hypercare/rag`

All RAG and safety orchestration run on the **server** (Route Handlers and `server-only` helpers). The browser must not import `@hypercare/rag` or call Bedrock-capable code; that keeps keys and heavy deps out of the client bundle. ADR 0010 is the full rationale.

**Enforcement:** `apps/web/eslint.config.mjs` — `@typescript-eslint/no-restricted-imports` blocks **value** imports of `@hypercare/rag` under `src/components` and `src/app` (excluding `src/app/api/**`, where type-only imports remain allowed in UI code). Core `no-restricted-imports` blocks `@aws-sdk/client-bedrock-runtime` under `src/**` except `api` routes, so a stray client bundle pull fails `pnpm --filter web lint`. After `next build`, `pnpm --filter web run check:client-bundle` greps `.next/static` for those strings in compiled client JS (belt-and-suspenders); the same step runs in CI after the monorepo build. `test/api-app-session-audit.test.ts` requires every `src/app/api/app/**/route.ts` to call `getSession` so the `/api/app` pass-through in middleware does not leave a handler unauthenticated.

## Schema note (TASK-011)

`messages` carries `citations` and `refusal` as **jsonb** (see `packages/db` migrations). Application code treats them as `Citation[]` and optional refusal payloads at the type layer; see ADR 0010 §7.

## Retention loop (TASK-024)

`packages/picker` (`@hypercare/picker`) is a pure, server-only module that returns one `PickerResult` for "This week's focus". Policy order, in priority sequence:

1. **Profile change in last 7d** — `care_profile_changes.field == "hardest_thing"` mapped to a `topics.slug` via `mapHardestTextToTopicSlug`, or an `inferred_stage` flip.
2. **Recent topic signal in last 14d** — `getRecentTopicSignal` (TASK-022) chooses the top topic; pick a stage-relevant module tagged with it.
3. **Stage baseline** — round-robin a stage-relevant published module by `modules.created_at`.

A 14-day **anti-repeat** rule excludes recently-completed modules unless every stage-baseline candidate has been seen, in which case a `no_pick` is returned and the home card prompts the library. ADR `docs/adr/0014-weeks-focus-picker-and-lesson-surface.md` is the full rationale.

The **Daily Lesson** at `/app/lesson/[slug]` slices `modules.body_md` on `##` headings into a fixed 6-card flow (setup → 3 core → try this today → close), pads with `summary` if fewer than three sections exist, and writes `lesson_progress` (`source ∈ weekly_focus | library_browse | search | conversation_link`; `revisit` set when the user picks "I want to revisit this").

The **Weekly check-in** card on `/app` shows when no `weekly_checkins` row exists in the last 7 days, **elevated** to 3 days when 2 or more soft `safety_flags` (category `self_care_burnout`) were recorded in the last 7d. Cadence logic lives in `apps/web/src/lib/home/checkin-cadence.ts` (`shouldShowCheckinFromLastPrompt` is pure).
