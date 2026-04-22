# Hypercare

Monorepo for the Hypercare caregiver web app (Next.js on AWS). Product and engineering conventions live in `PROJECT_BRIEF.md` and `prd.md`.

Local setup:

1. `pnpm install`
2. `pnpm dev` — runs the Next.js app in `apps/web`
3. `pnpm lint` — ESLint across workspaces
4. `pnpm typecheck` — TypeScript across workspaces

**Workspace packages:** `packages/content` holds Zod schemas and parsers for expert-reviewed learning modules (content pipeline / TASK-008). `packages/safety` — crisis classifier (Layer A rules + Layer B LLM on Bedrock), see `docs/adr/0009-safety-classifier-v0.md` and `tasks/TASK-010-safety-classifier.md`. `packages/eval` — golden-set eval harness (retrieval / safety / end-to-end answers); `pnpm --filter @hypercare/eval run eval -- all`, see `docs/adr/0011-eval-harness-v0.md`. **Auth:** shared Cognito user pool, PKCE, and an opaque `hc_session` cookie — see [`docs/adr/0004-auth-session-model.md`](docs/adr/0004-auth-session-model.md) and [`docs/auth-contract.md`](docs/auth-contract.md). **Home + conversation UI (served app shell, RAG handoff, citations/refusals):** see [`docs/adr/0010-conversation-ui-v0.md`](docs/adr/0010-conversation-ui-v0.md); [ARCHITECTURE.md](ARCHITECTURE.md) maps routes and the server-only RAG boundary.
