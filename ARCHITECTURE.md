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
| `/app/help` | In-app help hub |
| `/app/saves` | Saved answers |
| `/app/profile` | Profile (includes privacy & data, transparency UI) |
| `/app/profile/history` | Profile change history |
| `/onboarding/*` | Onboarding wizard |
| `/help` | Help (public); `/help/burnout-check` |

## App API (browser → server, session required)

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/app/conversation/start` | Create `conversations` row; client redirects to thread |
| `GET` | `/api/app/conversation/[id]` | JSON thread (messages) for reload / tests |
| `POST` | `/api/app/conversation/[id]/message` | User turn + `rag.answer()` + persist assistant turn |
| `POST` `GET` | `/api/app/this-weeks-focus` | Run `pickThisWeeksFocus` (TASK-024) |
| `GET` | `/api/app/lesson/[slug]` | Lesson payload: **`Accept: text/event-stream`** + server `STREAMING_LESSONS=1` → SSE card stream (`started` → `card` → `done` / `error`); else JSON one-shot (`mod` + profile hints). **Both** `STREAMING_LESSONS` and `NEXT_PUBLIC_STREAMING_LESSONS` must be on for the app’s streaming path. See `docs/adr/0029-streaming-lessons-and-library.md` |
| `POST` | `/api/app/lesson/[slug]/start` | Insert `lesson_progress` row, return `progressId` |
| `POST` | `/api/app/lesson/[slug]/complete` | Set `completed_at` + `revisit` on `lesson_progress` |
| `POST` | `/api/app/checkin` | Answer weekly check-in (`tried_something`, optional `what_helped`) |
| `POST` | `/api/app/checkin/skip` | Stamp `prompted_at` only (skipped) |
| `GET` | `/api/app/checkin/should-show` | Cadence + soft-flag elevation for the home card |
| `POST` | `/api/app/library/search` | Library search: JSON or **`Accept: text/event-stream`** when `STREAMING_LIBRARY` and `NEXT_PUBLIC_STREAMING_LIBRARY` are on (TASK-041); otherwise SSE returns **404** and the UI falls back to client-side filtering |
| `POST` | `/api/app/feedback` | User feedback (TASK-036) |
| `POST` | `/api/app/messages/[messageId]/rating` | Per-message helpfulness rating |
| `GET`, `POST` | `/api/app/saved-answers`, `/api/app/saved-answers/[id]` | Saved answers |
| `POST`, `GET` | `/api/app/privacy/export`, `/api/app/privacy/export/status`, `/api/app/privacy/delete`, `/api/app/privacy/sessions`, `/api/app/privacy/sessions/revoke` | Privacy self-serve export/delete/sessions (TASK-032); export needs S3-related env in production |
| Various | `/api/app/transparency/memory`, `/api/app/transparency/memory/forget`, `/api/app/transparency/memory/clear`, `/api/app/transparency/memory/refresh`, `/api/app/transparency/citations` | Transparency / “what we remember” (TASK-033) |
| `POST` | `/api/app/help/burnout` | Burnout check scoring payload |
| `GET` | `/api/app/suppression/status` | Whether home suppression is active after safety triage |

**`POST /api/app/conversation/[id]/message`:** Loads `users.routing_cohort` for Layer-5 model routing when **`MODEL_ROUTING=1`** (TASK-042). Default response is JSON; **`Accept: text/event-stream`** plus **`STREAMING_ANSWERS`** and **`NEXT_PUBLIC_STREAMING_ANSWERS`** enables the streaming answer path (ADR 0020).

#### Cron jobs (`Authorization: Bearer ${CRON_SECRET}`)

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/cron/feedback-sla` | Feedback queue SLA sweep (TASK-036) |
| `POST` | `/api/cron/safety-ft-shadow-prune` | Prune aged `safety_ft_shadow_decisions` rows (TASK-039) |

#### Internal (`/api/internal/*` and `/internal/*` pages)

Content workflow (`/internal/content/*`), **`/internal/metrics`** (operator telemetry; ADR 0019), **`/internal/feedback`** (Care Specialist triage on thumbs-down with safety context), **`/internal/safety`** (fine-tuned shadow stats), **`/internal/modules-search`**. Access patterns: `docs/infra-runbook.md`, `tasks/TASK-036`, `tasks/TASK-039`.

Unauthenticated calls to `/api/app/*` handlers above return **401** JSON (session middleware does not redirect `/api/app/*` to the login page so `fetch` and tests see a proper status).

## Import boundary: browser never loads `@hypercare/rag`

All RAG and safety orchestration run on the **server** (Route Handlers and `server-only` helpers). The browser must not import `@hypercare/rag` or call Bedrock-capable code; that keeps keys and heavy deps out of the client bundle. ADR 0010 is the full rationale.

**Enforcement:** `apps/web/eslint.config.mjs` — `@typescript-eslint/no-restricted-imports` blocks **value** imports of `@hypercare/rag` under `src/components` and `src/app` (excluding `src/app/api/**`, where type-only imports remain allowed in UI code). Core `no-restricted-imports` blocks `@aws-sdk/client-bedrock-runtime` under `src/**` except `api` routes, so a stray client bundle pull fails `pnpm --filter web lint`. After `next build`, `pnpm --filter web run check:client-bundle` greps `.next/static` for those strings in compiled client JS (belt-and-suspenders); the same step runs in CI after the monorepo build. `test/api-app-session-audit.test.ts` requires every `src/app/api/app/**/route.ts` to call `getSession` so the `/api/app` pass-through in middleware does not leave a handler unauthenticated.

## Schema note (TASK-011)

`messages` carries `citations` and `refusal` as **jsonb** (see `packages/db` migrations). Application code treats them as `Citation[]` and optional refusal payloads at the type layer; see ADR 0010 §7.

## Schema-of-record (TASK-043)

The current data model lives across three additive snapshots:

- [`docs/schema-v0.md`](docs/schema-v0.md) — Sprint 1 baseline.
- [`docs/schema-v1.md`](docs/schema-v1.md) — Sprint 2 retention loop + Sprint 3/4 additions (conversation memory, transparency, feedback, etc.).
- [`docs/schema-v2.md`](docs/schema-v2.md) — **Sprint 5 schema-of-record.** Adds `lesson_review_schedule`, `care_profile_members`, `invite_tokens`, `safety_ft_shadow_decisions`, `model_routing_decisions`; the column additions `user_feedback.safety_relabel` and `users.routing_cohort`; and documents the deprecation of `care_profile.user_id`. Also re-indexes Sprint 5 ancillaries (`lesson_stream_telemetry`, `library_search_streams`) and the latent gap `user_suppression`.

New schema deltas land in v2 going forward (or fork into v3 if v2 grows past ~600 lines, per `CONTRIBUTING.md`).

## Retention loop (TASK-024)

`packages/picker` (`@hypercare/picker`) is a pure, server-only module that returns one `PickerResult` for "This week's focus". Policy order, in priority sequence:

1. **Profile change in last 7d** — `care_profile_changes.field == "hardest_thing"` mapped to a `topics.slug` via `mapHardestTextToTopicSlug`, or an `inferred_stage` flip.
2. **Recent topic signal in last 14d** — `getRecentTopicSignal` (TASK-022) chooses the top topic; pick a stage-relevant module tagged with it.
3. **Stage baseline** — round-robin a stage-relevant published module by `modules.created_at`.

A 14-day **anti-repeat** rule excludes recently-completed modules unless every stage-baseline candidate has been seen, in which case a `no_pick` is returned and the home card prompts the library. ADR `docs/adr/0014-weeks-focus-picker-and-lesson-surface.md` is the full rationale.

The **Daily Lesson** at `/app/lesson/[slug]` slices `modules.body_md` on `##` headings into a fixed 6-card flow (setup → 3 core → try this today → close), pads with `summary` if fewer than three sections exist, and writes `lesson_progress` (`source ∈ weekly_focus | library_browse | search | conversation_link`; `revisit` set when the user picks "I want to revisit this").

**Progressive transport (TASK-040):** When the flags above are set, the lesson page loads those cards via `GET` SSE instead of embedding the full module in the RSC; slices are the same as the non-streaming path. First-byte telemetry is stored in `lesson_stream_telemetry` and surfaced on `/internal/metrics` (lesson stream latency tile). Escape during load navigates to `/app?lesson_cancel=1` (home shows a short “Lesson cancelled” status). Picker/SRS work is unchanged; see ADR 0029.

The **Weekly check-in** card on `/app` shows when no `weekly_checkins` row exists in the last 7 days, **elevated** to 3 days when 2 or more soft `safety_flags` (category `self_care_burnout`) were recorded in the last 7d. Cadence logic lives in `apps/web/src/lib/home/checkin-cadence.ts` (`shouldShowCheckinFromLastPrompt` is pure).
