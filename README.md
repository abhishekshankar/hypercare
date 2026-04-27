# Alongside

Monorepo for the Alongside caregiver web app (Next.js on AWS). Product and engineering conventions live in `PROJECT_BRIEF.md` and `prd.md`.

Legacy AWS stack names may still be `Hypercare*` in docs and `cdk deploy` — see [`docs/infra-rename.md`](docs/infra-rename.md).

**Hosting:** The canonical production path is CloudFront → ALB → OpenNext Lambda (`infra/lib/web-stack.ts`). AWS Amplify Hosting is **deprecated** for this app — the `amplify.yml` at the repo root is preserved for historical reference only and is not wired to CI. See [`docs/adr/0032-amplify-hosting-deprecated.md`](docs/adr/0032-amplify-hosting-deprecated.md).

### Use the hosted app (all cloud)

The running product is **CloudFront → ALB → OpenNext Lambda** with **Aurora in the VPC**. Your browser only talks to HTTPS at the edge; you do **not** need `pnpm dev` or `./scripts/db-tunnel.sh` on your laptop.

1. Deploy **HypercareData-dev** (data) and **HypercareWeb-dev** (web) — see [`docs/infra-runbook.md`](docs/infra-runbook.md) § *Hosted web app (`HypercareWeb-dev`)*.
2. From repo root: `./infra/scripts/post-deploy-web.sh` (wires Lambda `AUTH_BASE_URL` / `AUTH_SIGNOUT_URL` to CloudFront).
3. Add the printed callback and sign-out URLs to your Cognito app client (same runbook).
4. Open the app: `./scripts/open-hosted-app.sh` (prints URL and opens the browser on macOS). To print only: `OPEN_BROWSER=0 ./scripts/open-hosted-app.sh`.

### Local development (changing code)

For engineers editing the Next.js app with hot reload and a DB tunnel to dev Aurora:

1. `pnpm install`
2. Apply DB migrations: `pnpm --filter @alongside/db migrate` (notably `0019_safety_ft_shadow_decisions` for TASK-039; `0020_library_search_streams` for TASK-041 library search telemetry).
3. `pnpm dev` — runs the Next.js app in `apps/web`
4. `pnpm lint` — ESLint across workspaces
5. `pnpm typecheck` — TypeScript across workspaces

For **Postgres** against the dev cluster from your laptop, keep **`./scripts/db-tunnel.sh`** running and set `DATABASE_URL` in `apps/web/.env.local` per [`docs/auth-runbook.md`](docs/auth-runbook.md).

**Conversation answer streaming (TASK-031):** `POST /api/app/conversation/[id]/message` with **`Accept: text/event-stream`** when **both** `STREAMING_ANSWERS=1` and `NEXT_PUBLIC_STREAMING_ANSWERS=1` are set. Otherwise the route returns JSON. See [`docs/adr/0020-streaming-answers.md`](docs/adr/0020-streaming-answers.md).

**Library search streaming (TASK-041):** incremental SSE search at `POST /api/app/library/search`. Requires **both** `STREAMING_LIBRARY=1` (server, e.g. Amplify / `.env.local`) and `NEXT_PUBLIC_STREAMING_LIBRARY=1` (browser build). If either is off, `/app/library` keeps the legacy client-side filter and the API route returns 404 for SSE. See [`docs/adr/0029-streaming-lessons-and-library.md`](docs/adr/0029-streaming-lessons-and-library.md).

**Safety fine-tuned classifier (TASK-039):** Layer B can run zero-shot Haiku (default), shadow-compare against a Bedrock fine-tuned model, or prefer the fine-tuned path with zero-shot fallback on invoke errors. See [`docs/adr/0028-fine-tuned-safety-classifier.md`](docs/adr/0028-fine-tuned-safety-classifier.md) and [`tasks/TASK-039-fine-tuned-safety-classifier.md`](tasks/TASK-039-fine-tuned-safety-classifier.md).

| Variable | Effect |
| -------- | ------ |
| `BEDROCK_SAFETY_FT_MODEL_ID` | Bedrock model or inference profile id for the fine-tuned Layer-B path. Required when shadow or live FT runs against real Bedrock. |
| `SAFETY_FT_SHADOW=1` | Run both classifiers; **live** user decision stays zero-shot; comparison rows go to `safety_ft_shadow_decisions` (SHA-256 of text, no raw message). If both shadow and live are set, shadow wins for the live decision. |
| `SAFETY_FT_LIVE=1` | Prefer fine-tuned for the live decision; zero-shot only on FT invoke failure. |

**Internal:** `/internal/safety` — 7-day shadow stats and sample disagreements (admin). **`/internal/feedback`** — Care Specialist “Safety re-label” on thumbs-down rows with safety context (`tasks/TASK-039` §8).

**Cron:** `POST /api/cron/safety-ft-shadow-prune` with `Authorization: Bearer ${CRON_SECRET}` — prunes shadow rows older than 30 days (same secret pattern as feedback SLA).

**Manual red-team gate (fine-tuned, live Bedrock + DB):** not run in default CI.

```bash
EVAL_LIVE=1 pnpm --filter @alongside/eval start -- redteam --fixture redteam-v2.yaml --gate --classifier fine_tuned
```

Use `--classifier zero_shot` for baseline. Build `@alongside/safety` before typechecking dependents: `pnpm --filter @alongside/safety build`.

**Workspace packages:** `packages/content` holds Zod schemas and parsers for expert-reviewed learning modules (content pipeline / TASK-008). `packages/safety` — crisis classifier (Layer A rules + Layer B LLM on Bedrock), see `docs/adr/0009-safety-classifier-v0.md` and `tasks/TASK-010-safety-classifier.md`. `packages/eval` — golden-set eval harness (retrieval / safety / end-to-end answers); `pnpm --filter @alongside/eval start -- all` (same as `pnpm --filter @alongside/eval run eval -- all` — *eval* is an alias for the ticket’s original script name, not the JS keyword). See `docs/adr/0011-eval-harness-v0.md`. `packages/picker` — pure "This week's focus" selector (profile change → recent topic → stage baseline, with 14-day anti-repeat); see [`docs/adr/0014-weeks-focus-picker-and-lesson-surface.md`](docs/adr/0014-weeks-focus-picker-and-lesson-surface.md) and `tasks/TASK-024-this-weeks-focus-and-daily-lesson.md`. **Auth:** shared Cognito user pool, PKCE, and an opaque `hc_session` cookie — see [`docs/adr/0004-auth-session-model.md`](docs/adr/0004-auth-session-model.md) and [`docs/auth-contract.md`](docs/auth-contract.md). **Home + conversation UI (served app shell, RAG handoff, citations/refusals):** see [`docs/adr/0010-conversation-ui-v0.md`](docs/adr/0010-conversation-ui-v0.md); [ARCHITECTURE.md](ARCHITECTURE.md) maps routes and the server-only RAG boundary. **Retention loop (TASK-024):** home renders `WeeksFocusCard`, optional `CheckinCard` (cadence with soft-flag elevation), and a 6-card `/app/lesson/[slug]` surface that writes `lesson_progress`.

Human-readable shipping notes and doc sync history: [CHANGELOG.md](CHANGELOG.md).
