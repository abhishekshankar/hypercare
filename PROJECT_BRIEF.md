# Hypercare — Project Brief for Cursor

> Read this file before touching any ticket. It defines the contract.

This brief is the single source of truth for stack decisions, conventions, and the definition of done. The full product spec is in `prd.md`. Tickets live in `tasks/` and are tracked in `TASKS.md`.

---

## 1. Roles

- **Product Manager (PM)** — drafts tickets in `tasks/`, reviews each completed task before unblocking the next.
- **Cursor (you)** — executes one ticket at a time in ID order, reports back per the "Reporting back" section.
- **User (abhishek)** — runs Cursor, runs the app locally, has the AWS console, owns the other project that issues auth.

PM does not write feature code. Cursor does not invent stack choices. If a ticket is ambiguous, **stop and ask in the report-back, do not guess**.

## 2. Stack — locked

| Layer         | Choice                                                                                                                                      | Notes                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Web app       | Next.js 15 (App Router, TypeScript, React Server Components)                                                                                | Single Next.js app, no separate SPA.                                                                        |
| Hosting       | AWS Amplify Hosting                                                                                                                         | SSR enabled. CI from `main`.                                                                                |
| API           | Next.js Route Handlers (server actions where they fit)                                                                                      | No separate AppSync layer in v1; revisit if mobile arrives.                                                 |
| DB            | Aurora PostgreSQL Serverless v2                                                                                                             | One cluster, two databases: `hypercare_dev`, `hypercare_prod`.                                              |
| Vector        | `pgvector` extension on the same Aurora cluster                                                                                             | One store, simpler ops. PRD §9.4.                                                                           |
| Auth          | **AWS Cognito user pool — shared with the other project (the "main" project).** Hypercare is a **second app client** on that existing pool. | See §4.                                                                                                     |
| LLM           | AWS Bedrock                                                                                                                                 | Claude Sonnet/Opus for generation; Claude Haiku for the safety classifier and the post-generation verifier. |
| Embeddings    | Bedrock-hosted embedding model (Titan Text Embeddings v2 to start)                                                                          | Tickets may revisit if retrieval quality is weak.                                                           |
| Reranker      | Cohere Rerank via Bedrock if available, else skip in v1                                                                                     | Decision deferred to the retrieval ticket.                                                                  |
| Storage       | S3 for any blobs (rare in v1)                                                                                                               |                                                                                                             |
| Secrets       | AWS Secrets Manager + Amplify env vars                                                                                                      | No secrets in the repo, ever.                                                                               |
| IaC           | AWS CDK (TypeScript) in `/infra`                                                                                                            | Every cloud resource defined in CDK. No click-ops in production.                                            |
| Observability | CloudWatch Logs + structured JSON logs from the app                                                                                         | Every LLM call logs query / retrieved chunks / prompt / response. PRD §9.4.                                 |

**Out of scope for v1 stack:** mobile apps, native push, websockets, queue workers (until the content pipeline ticket forces one).

## 3. Repo layout

```
/                        repo root
  prd.md                 product spec (read-only reference)
  PROJECT_BRIEF.md       this file
  TASKS.md               sprint board
  tasks/                 individual ticket files (TASK-NNN-slug.md)
  docs/                  ADRs, runbooks, schema notes
  apps/web/              Next.js app
  packages/              shared TS packages (only when needed; default to apps/web)
    db/                  drizzle schema + migrations
    rag/                 retrieval + prompt composition + verification
    safety/              classifier + escalation flows
    eval/                red-team + golden-answer eval harness
  infra/                 AWS CDK app
  .github/workflows/     CI
```

The monorepo is **pnpm workspaces**. No Turborepo / Nx in v1 — keep it boring.

## 4. Auth integration with the other project

Hypercare does **not** own user identity. The other project ("main project") owns the Cognito user pool. Hypercare is a second app client.

Cognito handoff for TASK-002 is **documented in `docs/auth-contract.md`** (pool ID, region, app client, OAuth scopes, callback and sign-out URLs, Hosted UI domain, JWKS, custom attributes — none — and client-secret notes).

Implementation: `aws-amplify` v6 with the `auth` category configured against the existing pool. Server-side session validation via the Cognito JWKS. **No password fields in the Hypercare UI** — sign-in routes through the shared Hosted UI (or a token bridge if the main project provides one). If the main project hands off via a redirect with a Cognito session cookie or a one-time code, the auth ticket will detail that flow when implemented.

**Session model (entry point):** PKCE authorization code flow, token exchange and JWKS verification on the server, **`hc_session` opaque HMAC cookie** (not a browser-visible Cognito JWT) — see [`docs/adr/0004-auth-session-model.md`](docs/adr/0004-auth-session-model.md).

### Environment variables (runtime vs operator)

- **`DATABASE_URL`**: Postgres URL for the **`hypercare_app`** role; used by the Next.js app and app-owned jobs. Required for auth callback user upsert and any DB-backed route.
- **`DATABASE_URL_ADMIN`**: Optional **operator/bootstrap** URL (admin or migration role) for tunnels, `drizzle-kit`, and one-off DBA tasks. **Do not** point the web app or `env.server.ts` at this; keep app traffic on the least-privileged role. Details: `docs/infra-runbook.md`.
- **`BEDROCK_ANSWER_MODEL_ID`**: Optional override for the RAG answering model (Claude on Bedrock). Default is the Haiku 4.5 `us.*` system inference profile id in `packages/rag` config; set this if your account exposes a different profile id. See `docs/adr/0008-rag-pipeline-v0.md` §4.
- **`BEDROCK_CLASSIFIER_MODEL_ID`**: Optional override for the safety classifier’s Layer B model (same default family / inference-profile pattern as the answerer). Default in `packages/safety/src/config.ts`; see `docs/adr/0008-rag-pipeline-v0.md` §4 and `docs/adr/0009-safety-classifier-v0.md` §5.
- **`EVAL_LIVE`**: Set to `1` to run the `@hypercare/eval` harness against **real** Postgres (`DATABASE_URL`) and Bedrock (unset = offline fixtures, deterministic). See `docs/adr/0011-eval-harness-v0.md`.
- **`EVAL_USER_ID`**: Optional; when set with `EVAL_LIVE=1`, passed through as the `userId` in answer eval so `loadStage` can resolve a real `care_profile` (defaults to a synthetic `eval-answers:…` id if unset).

## 5. Conventions

- **Language**: TypeScript everywhere. `strict: true`. No `any` without a `// eslint-disable-next-line` and a comment.
- **Lint/format**: ESLint + Prettier. CI fails on warnings.
- **DB**: Drizzle ORM. Migrations are SQL files under `packages/db/migrations`, applied with `drizzle-kit`. Never edit a shipped migration — write a new one.
- **Env vars**: Validated at boot with `zod`. Missing required vars = process exits with a clear error.
- **Errors**: Never swallow. Log with structured context. User-facing messages are kind and never expose internals.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). One ticket = one branch = one PR.
- **Branches**: `task/TASK-NNN-short-slug`.
- **PRs**: Title = ticket title. Body = ticket link + a checklist mirroring the ticket's acceptance criteria, each ticked.
- **Tests**: Vitest for unit, Playwright for the one happy-path E2E we ship in sprint 1. Coverage is not a target; **the eval harness is the real quality gate** for RAG output.
- **No new dependencies without justification in the PR description.** No `lodash`, no UI kits in v1 — Tailwind + a few shadcn/ui primitives only.

## 6. Definition of Done — applies to every ticket

A ticket is **not** done until all of the following are true:

1. Acceptance criteria in the ticket are each demonstrably met.
2. `pnpm lint && pnpm typecheck && pnpm test` all pass locally.
3. CI is green on the PR.
4. The PR description mirrors the ticket's acceptance checklist, each box ticked, with line-level pointers (`apps/web/...:42`) where useful.
5. New env vars are documented in `.env.example` with a comment.
6. New AWS resources exist in CDK (`/infra`), not console-clicked.
7. A short "How to verify" section in the PR description tells the PM exactly which commands to run and which URLs to hit.
8. **Out-of-scope items in the ticket were not silently expanded.** If scope grew, raise it in the report-back, do not just ship more.

## 7. Reporting back to PM

When you finish a ticket, your final message to the user must contain:

```
TASK-NNN status: ready for review

Branch: task/TASK-NNN-...
PR: <link or "not pushed">

Acceptance criteria:
- [x] criterion 1 — apps/web/...:42
- [x] criterion 2 — packages/db/...
- [ ] criterion 3 — BLOCKED: <reason>

How to verify:
1. `pnpm install`
2. `pnpm dev`
3. Visit http://localhost:3000/...
4. Expect: ...

Decisions I made (PM to confirm):
- Chose X over Y because ...

Questions for PM:
- ...

Out of scope I noticed but did not do:
- ...
```

If any acceptance criterion is unchecked, the status line is `blocked: <reason>`, not `ready for review`.

## 8. What Cursor must never do

- Invent or change stack choices in §2.
- Add a dependency that duplicates something already chosen.
- Edit a shipped migration.
- Commit secrets, even temporarily.
- **Fetch, print, or log any value from AWS Secrets Manager, Parameter Store, or any other secret store** — including "just to test that it works." Reading Aurora admin credentials, Cognito client secrets, Bedrock keys, or any other sensitive material is a **PM/operator activity**, not a Cursor activity. If a ticket needs the presence of a secret verified, verify it by its ARN and metadata (`aws secretsmanager describe-secret`), never its value. If a ticket genuinely needs a secret value at runtime (e.g. a Lambda), the code retrieves it at runtime from Secrets Manager at the deployed runtime's identity — it never flows through Cursor's shell.
- Mark a ticket complete with failing tests.
- Skip the safety / refusal / verification layers when wiring the RAG pipeline. PRD §9 and §10 are non-negotiable.
- Generate medical content. All content is sourced and reviewed (PRD §7, §8). The pipeline only retrieves and renders.

### If Cursor accidentally exposes a secret

Stop. Report it in the next message, clearly, with a one-line "SECURITY: <what leaked, where>" at the top. Do not try to clean it up silently. The PM will rotate and document. A leaked secret reported is a near-miss; a leaked secret hidden is an incident.

## 9. Where to look first

- `prd.md` — product spec
- `TASKS.md` — what's pending / in-progress / done
- `tasks/TASK-001-*.md` — start here
- `docs/adr/` — architectural decision records (created as needed)
