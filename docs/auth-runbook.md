# Auth runbook (Cognito + Alongside)

Operational notes for the shared-pool, Hosted UI, and session cookie introduced in [TASK-006](../tasks/TASK-006-cognito-auth.md). Contract values live in [`auth-contract.md`](auth-contract.md).

## Environment layout

- **`apps/web/.env.local`** (local, gitignored): non-secret and development-only values; the PM copies allowed URLs from `auth-contract.md`. Do **not** paste the Cognito app client secret into a ticket, chat, or log.
- **`COGNITO_APP_CLIENT_SECRET`**: in deployed environments, load from **AWS Secrets Manager** (or the host’s secret store) into the runtime environment—never commit it. The Alongside `hypercare` app client is **confidential**; only **server** code may read this value (see `env.server.ts` + `env.client.ts` split in `apps/web`).
- **`SESSION_COOKIE_SECRET`**: long random string (32+ bytes). Generate e.g. `openssl rand -base64 32`. If leaked, treat as credential leak: rotate in all environments and accept forced sign-out.
- **Database:** `DATABASE_URL` must use the `hypercare_app` role in runtime (not admin). See `docs/infra-runbook.md` for tunneling and bootstrap.
- **RDS from local:** the dev cluster is in a private subnet. You **cannot** put the `*.rds.amazonaws.com` host directly in `DATABASE_URL`; instead run `./scripts/db-tunnel.sh` (SSM port-forward, default `localhost:15432`) and set `DATABASE_URL=postgresql://hypercare_admin:<encoded-pw>@127.0.0.1:15432/hypercare_dev?sslmode=require`. The tunnel forwards raw TCP, so the Postgres TLS handshake is end-to-end—`sslmode=require` is required.
- **TLS auto-enable:** the `@alongside/db` client sets `ssl: 'require'` for `*.rds.amazonaws.com` and for any URL with `sslmode=(require|verify-*)` or `ssl=true`. Loopback hosts (`localhost`, `127.0.0.1`) won't get TLS auto-enabled, so be explicit when tunneling to RDS.
- **Special characters in the password:** URI userinfo breaks if the password contains `:`, `@`, `/`, `#`, etc., unless each is **percent-encoded** (e.g. `:` → `%3A`). Encode **only** the password segment, then rebuild `postgresql://user:ENCODED_PASS@host:port/db`. If sign-in fails with `user_upsert`, check the `next dev` terminal for the underlying Postgres error.

## Per-environment URL mapping (must match Cognito **exactly**)

From [`auth-contract.md`](auth-contract.md) callback and sign-out tables:

| Environment | `AUTH_BASE_URL` (app base) | `redirect_uri` for OAuth | `AUTH_SIGNOUT_URL` (Cognito `logout_uri`) |
|-------------|----------------------------|----------------------------|-------------------------------------------|
| Local | `http://localhost:3000` | `http://localhost:3000/api/auth/callback` | `http://localhost:3000` |
| Amplify (**a**) | `https://main.d1ajzemw7s1n5f.amplifyapp.com` | `…/api/auth/callback` | `https://main.d1ajzemw7s1n5f.amplifyapp.com` |
| Production (**b**) | `https://cogcare.org/care1` (path) | `https://cogcare.org/care1/api/auth/callback` | `https://cogcare.org` (root, not under `/care1`) |

`AUTH_BASE_URL` must not have a trailing slash. **Production** is the special case where sign-out is registered at the site root, while the app (and callback) use the `/care1` path.

### `invalid_state` on the sign-in error page (local)

Cognito’s registered callback is **`http://localhost:3000/api/auth/callback`** (see `auth-contract.md`), not `127.0.0.1`. The short-lived PKCE cookie (`hc_oauth`) is **host-scoped**. If you start on **`http://127.0.0.1:3000`** but Cognito returns you to **`localhost`** (or the reverse), the cookie is not sent and you see **`invalid_state`**. Prefer **`http://localhost:3000`** everywhere so it matches `AUTH_BASE_URL`. In development, middleware also normalizes between **`localhost`** and **`127.0.0.1`** so the cookie host matches the callback.

## Rotating `SESSION_COOKIE_SECRET`

1. Generate a new secret (`openssl rand -base64 32`).
2. Deploy with **dual verification** (not implemented): either accept one logout for all users, or run two valid secrets during a short window (Sprint 2+ if required).
3. For v1, rotate during a **maintenance window** and expect all users to sign in again.

## Rotating the Cognito app client secret

1. In Cognito, generate a new secret for the `hypercare` app client.
2. Update the value in Secrets Manager and redeploy so `COGNITO_APP_CLIENT_SECRET` updates **before** revoking the old secret.
3. Never paste the new value in Cursor, CI logs, or support threads.

## Local dev loop (PM / operator, not the agent)

1. Pull secrets from AWS per your org’s policy (e.g. `aws secretsmanager get-secret-value` with MFA)—**do not** pipe the client secret into agent-visible terminals if your policy forbids it.
2. Put **non-secret** values and the secret in `apps/web/.env.local` on the dev machine.
3. Ensure DB tunnel is up if you need the callback to upsert `users`: `DATABASE_URL` pointing at the tunneled `hypercare_app` URL.
4. `pnpm --filter web dev` → open `http://localhost:3000/app` → expect redirect to Hosted UI, then return to `/app`.

**Instrumentation / `env.server`:** In **development**, `apps/web/src/instrumentation.ts` skips eager validation of `env.server` so the dev server can boot before `.env.local` exists; the **first route that imports `env.server`** still fails loudly if required vars are missing. In **production** (`next start`), instrumentation eagerly loads `env.server` on Node startup so misconfiguration fails immediately—this is why you may not see a process-level env error in dev until you hit an authenticated or DB-backed path.

### Amplify: “Internal Server Error” on every page (including `/`)

After Hosting compute (`WEB_COMPUTE`) is wired up, a blanket **500** with body `Internal Server Error` almost always means **`env.server` failed during `instrumentation` boot** (before any route runs). Check **Amplify → Hosting → Build / hosting logs** (or **CloudWatch** logs for the compute function) for: `Invalid or missing environment variables` or the `[hypercare] Server boot: env.server validation failed` line.

Copy the same keys you use in `apps/web/.env.local` into **Amplify → Hosting → Environment variables** for the branch (server-only; no `NEXT_PUBLIC_*` in this list). Required keys are defined in **`apps/web/src/lib/env.server.ts`** (Zod `serverSchema`); at minimum:

| Variable | Notes |
|----------|--------|
| `COGNITO_USER_POOL_ID` | From `auth-contract.md` |
| `COGNITO_APP_CLIENT_ID` | |
| `COGNITO_APP_CLIENT_SECRET` | Confidential client secret (server-only); from Cognito / Secrets Manager |
| `COGNITO_DOMAIN` | Full URL, `https://…` |
| `COGNITO_REGION` | e.g. `ca-central-1` |
| `AUTH_BASE_URL` | Amplify app URL, no trailing slash — see table above (**a**) |
| `AUTH_SIGNOUT_URL` | Cognito sign-out allowlist; for Amplify often same host as `AUTH_BASE_URL` |
| `SESSION_COOKIE_SECRET` | `openssl rand -base64 32` (must meet schema min length) |
| `DATABASE_URL` | `postgres(ql)://…` reachable from Amplify compute (VPC / security group if RDS) |

Redeploy after saving variables. Optional keys (`DATABASE_URL_ADMIN`, `CRON_SECRET`, streaming flags, etc.) are in the same schema.

## PM verification checklist (TASK-006 gate, before TASK-009)

Human-in-the-loop only; Cursor cannot drive Hosted UI or your tunnel.

1. Fill `apps/web/.env.local` from [`auth-contract.md`](auth-contract.md) and this runbook. **Do not commit.**
2. `pnpm --filter web dev` — `http://localhost:3000` loads.
3. Open `/app` — expect redirect to `/api/auth/login` then Cognito authorize URL with **`response_type=code`**, **`code_challenge_method=S256`**, **`code_challenge=…`**.
4. Sign in with a real pool user.
5. Confirm **`users`** row for your `cognito_sub` (DB via tunnel) and **`hc_session`** in the browser: **HttpOnly**, ~**8h** expiry, **opaque** (not a JWT); no access/refresh token in cookie.
6. **`POST /api/auth/logout`** — Cognito logout → **`AUTH_SIGNOUT_URL`**; cookie cleared.
7. `/app` again → redirect to login (unauthenticated).

If TASK-007 is enabled, `/app` may redirect into onboarding first; session + `users` upsert still prove **006**. Full numbered list and notes: [`tasks/TASK-006-cognito-auth.md`](../tasks/TASK-006-cognito-auth.md) § “How the PM will verify”.

## E2E (Playwright)

- `pnpm --filter web test:e2e` uses committed placeholder env in `apps/web/test/e2e/e2e-server-env.json` to boot Next and assert PKCE and middleware redirects. It does **not** perform a real Cognito sign-in; full Hosted UI sign-in is the manual checklist above.

## Co-caregiver invites (TASK-038)

Family sharing uses **the same Cognito pool and Hosted UI** as today: an invited person signs up or signs in, then completes **invite acceptance** in-app (token from email or copy-link flow — product wiring in the ticket). **Do not** create a second Alongside-specific identity system.

- **Email delivery:** strawman is the pool’s **transactional / Cognito-backed** path (no new SMTP infra in v1). Until that is wired, dev can mint tokens via API and paste an accept URL; see [ADR 0027](adr/0027-family-sharing-data-model-and-privacy.md) § “Transactional email”.
- **Acceptance:** requires a valid `hc_session` for the **same email** as the pending `care_profile_members.invitee_email` row (normalized lowercase). Schema: `docs/schema-v1.md` § `care_profile_members` / `invite_tokens`.

## See also

- [`auth-contract.md`](auth-contract.md) — pool ID, app client, Hosted UI domain, JWKS URL.
- [ADR 0001](adr/0001-shared-cognito-with-main-project.md) — shared pool decision.
- [ADR 0004](adr/0004-auth-session-model.md) — session cookie, PKCE, middleware scope.
- [ADR 0027](adr/0027-family-sharing-data-model-and-privacy.md) — family sharing data model + default privacy.
