# Hypercare

Monorepo for the Hypercare caregiver web app (Next.js on AWS). Product and engineering conventions live in `PROJECT_BRIEF.md` and `prd.md`.

Local setup:

1. `pnpm install`
2. `pnpm dev` — runs the Next.js app in `apps/web`
3. `pnpm lint` — ESLint across workspaces
4. `pnpm typecheck` — TypeScript across workspaces

**Workspace packages:** `packages/content` holds Zod schemas and parsers for expert-reviewed learning modules (content pipeline / TASK-008). `packages/safety` — crisis classifier (Layer A rules + Layer B LLM on Bedrock), see `docs/adr/0009-safety-classifier-v0.md` and `tasks/TASK-010-safety-classifier.md`. `packages/eval` — golden-set eval harness (retrieval / safety / end-to-end answers); `pnpm --filter @hypercare/eval start -- all` (same as `pnpm --filter @hypercare/eval run eval -- all` — *eval* is an alias for the ticket’s original script name, not the JS keyword). See `docs/adr/0011-eval-harness-v0.md`. `packages/picker` — pure "This week's focus" selector (profile change → recent topic → stage baseline, with 14-day anti-repeat); see [`docs/adr/0014-weeks-focus-picker-and-lesson-surface.md`](docs/adr/0014-weeks-focus-picker-and-lesson-surface.md) and `tasks/TASK-024-this-weeks-focus-and-daily-lesson.md`. **Auth:** shared Cognito user pool, PKCE, and an opaque `hc_session` cookie — see [`docs/adr/0004-auth-session-model.md`](docs/adr/0004-auth-session-model.md) and [`docs/auth-contract.md`](docs/auth-contract.md). **Home + conversation UI (served app shell, RAG handoff, citations/refusals):** see [`docs/adr/0010-conversation-ui-v0.md`](docs/adr/0010-conversation-ui-v0.md); [ARCHITECTURE.md](ARCHITECTURE.md) maps routes and the server-only RAG boundary. **Retention loop (TASK-024):** home renders `WeeksFocusCard`, optional `CheckinCard` (cadence with soft-flag elevation), and a 6-card `/app/lesson/[slug]` surface that writes `lesson_progress`.
