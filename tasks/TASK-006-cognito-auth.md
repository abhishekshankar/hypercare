# TASK-006 — Cognito auth wired (Amplify Auth v6), protected routes, server-side session

**Owner:** Cursor
**Depends on:** TASK-002, TASK-005
**Status:** pending

## Why this exists

Hypercare delegates identity to the main project's Cognito user pool (PROJECT_BRIEF §4). TASK-002 recorded the contract; TASK-005 shipped the app skeleton. This ticket is the one place we turn that paper contract into a working login, a validated server-side session, and a route guard. Every ticket after this assumes a caller is either authenticated or bounced to Hosted UI — onboarding writes (TASK-007), conversations (TASK-011), and the safety classifier's audit writes (TASK-010) all need a trustworthy `user_id` derived from the Cognito `sub`.

**This is auth wiring, not a profile system.** No password UI, no signup, no MFA flows (PRD §4, `docs/auth-contract.md` "What Hypercare must not do"). The Hosted UI owns all of that.

## Context to read before starting

- `docs/auth-contract.md` — the real values (pool ID, app client ID, region, Hosted UI domain, JWKS URL, callback and sign-out URLs, scopes). Use these verbatim; do not invent. In particular: **the app client has a client secret**, and the token exchange must happen server-side.
- `PROJECT_BRIEF.md §2` (stack: Amplify Auth v6, Next.js 15 App Router, Route Handlers), `§5` (Conventions — env vars validated with `zod` at boot; errors never expose internals), `§8` (never fetch, print, or log secret values — the Cognito client secret is read at runtime by the deployed runtime's identity, never by Cursor's shell).
- `prd.md §4` — delegated auth, no password fields in Hypercare.
- `apps/web/` — the existing Next.js app skeleton from TASK-005. Next 15.5, React 19, App Router, Tailwind v4, Vitest.
- `packages/db/src/schema/users.ts` — the `users` table already keys on `cognito_sub`. This ticket adds the read/write-through path.

## What "done" looks like

A signed-out visitor who hits any route under `/app/**` (the protected area) is redirected to Cognito Hosted UI. After Hosted UI redirects back to `/api/auth/callback`, the server exchanges the code for tokens, validates the ID token against the pool's JWKS, sets a secure HTTP-only session cookie, upserts a `users` row keyed on `cognito_sub`, and lands the user on `/app`. A server component anywhere in `/app/**` can call `getSession()` and get a typed `{ userId, cognitoSub, email }`. Signing out clears the cookie and redirects through Cognito's `/logout` endpoint to an allowed sign-out URL.

## Acceptance criteria

### Dependencies

- [ ] `apps/web` adds `aws-amplify` v6 (pinned to the latest 6.x minor at time of writing — record the version in the PR), `jose` for JWKS validation, and `zod` for env parsing. No `next-auth` / `@auth/core`. The auth shape is Cognito-native; adding an abstraction layer now only adds bugs.
- [ ] No `pg`, no extra token libraries. Keep the dep graph boring (PROJECT_BRIEF §5).

### Configuration

- [ ] `apps/web/src/lib/auth/config.ts` — a single `AMPLIFY_AUTH_CONFIG` constant that constructs the Amplify v6 `Auth` config from validated env vars. Values come from `docs/auth-contract.md`. Shape:
  - `userPoolId`, `userPoolClientId`, `region`.
  - `loginWith.oauth`: `domain` (Hosted UI), `scopes: ["openid", "email", "profile"]`, `redirectSignIn: [<callback URL for this env>]`, `redirectSignOut: [<sign-out URL for this env>]`, `responseType: "code"`.
- [ ] `apps/web/src/lib/env.ts` (or extend if it exists from TASK-005) — `zod`-validated required env vars. Missing or malformed values crash the process at boot with a human-readable error (PROJECT_BRIEF §5). Required:
  - `COGNITO_USER_POOL_ID`
  - `COGNITO_APP_CLIENT_ID`
  - `COGNITO_APP_CLIENT_SECRET` — **server-only**. Use `zod` to guarantee it's present on the server and absent from any client bundle. Import `env.server.ts` only from server files; a second `env.client.ts` exposes the public subset. **This split is load-bearing — the client secret must never ship in a browser bundle.**
  - `COGNITO_DOMAIN` — the Hosted UI base URL.
  - `COGNITO_REGION`
  - `AUTH_BASE_URL` — e.g. `http://localhost:3000` locally, the Amplify URL in preview, `https://cogcare.org/care1` in prod. Used to compose callback and sign-out URLs so the four-value set in `auth-contract.md` resolves correctly per environment.
  - `SESSION_COOKIE_SECRET` — 32+ bytes used to sign the session cookie. Documented in `.env.example` with a comment on how to generate one.
- [ ] `.env.example` gets new entries with comments. **No real values.** For `COGNITO_APP_CLIENT_SECRET`, the comment points at Secrets Manager + the runbook — do not paste the secret into `.env.example` or any checked-in file.

### Route Handlers

All handlers live under `apps/web/src/app/api/auth/` as Next.js Route Handlers (not Pages API).

- [ ] `GET /api/auth/login` — generates a PKCE `code_verifier` + `code_challenge`, stores the verifier plus an anti-CSRF `state` value in a short-lived HTTP-only cookie (encrypted with `SESSION_COOKIE_SECRET`), and 302s to Cognito's `/oauth2/authorize` with the correct `client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`, and PKCE params. **PKCE is mandatory even though the client has a secret** — belt and suspenders, per `auth-contract.md` note.
- [ ] `GET /api/auth/callback` — validates `state`, consumes the PKCE verifier cookie, exchanges `code` at Cognito's `/oauth2/token` endpoint. The request includes the app client id + client secret via HTTP Basic auth (the client-secret path) **and** the PKCE verifier. Validates the returned ID token against the pool's JWKS (`jose`'s `createRemoteJWKSet` + `jwtVerify`, cached across requests), checks `iss`, `aud` (= app client id), `token_use === "id"`, and `exp`. On success: upserts `users` (see below), writes the session cookie, 302s to `/app` (or a `?next=` param if present and same-origin).
- [ ] `POST /api/auth/logout` — clears the session cookie, then 302s to Cognito's `/logout` with `client_id` and `logout_uri` pointing at the env-appropriate allowed sign-out URL.
- [ ] `GET /api/auth/me` — returns the current session as JSON or 401 if unauthenticated. Useful for client components and for the Playwright happy-path test.
- [ ] Error paths on all four return a human-readable page at `/auth/error?reason=<code>` — never an internals dump. Log the real error server-side with structured context (`{ stage, reason, requestId }`), per PROJECT_BRIEF §5.

### Session model

- [ ] `apps/web/src/lib/auth/session.ts` exports:
  - `getSession(): Promise<Session | null>` — reads the cookie, verifies the signed payload, returns `{ userId: string, cognitoSub: string, email: string, expiresAt: number } | null`. Never throws on unauthenticated; returns `null`.
  - `requireSession(): Promise<Session>` — wraps `getSession`, throws a `redirect("/api/auth/login?next=<current>")` if null. Usable from server components and Route Handlers.
  - `setSession(data, { maxAgeSeconds })`, `clearSession()` — used by the callback and logout handlers.
- [ ] The session cookie itself:
  - Name: `hc_session`.
  - `HttpOnly`, `Secure` (except in local dev over http — gate on `process.env.NODE_ENV`), `SameSite=Lax`, `Path=/`.
  - Contents: a signed (HMAC-SHA256) payload of `{ userId, cognitoSub, email, iat, exp }`. Do **not** stuff the Cognito access token or refresh token into the cookie — those stay server-side. For v1, an opaque session with a short TTL (default 8 hours) is enough.
  - Signed with `SESSION_COOKIE_SECRET` using a small helper in `apps/web/src/lib/auth/cookie.ts`. Constant-time comparison on verify.
- [ ] Refresh flow is **out of scope for v1**: when the session expires, the user is sent back through `/api/auth/login`. Document this in the ADR and in the PR. Sprint 2 can add silent refresh if it becomes painful.

### Route protection

- [ ] `apps/web/src/middleware.ts` (Next.js middleware, Edge runtime) protects every path under `/app/**` and `/api/app/**`. Unauthenticated requests to those paths are redirected to `/api/auth/login?next=<original-path>`. Public paths (`/`, `/auth/**`, `/api/auth/**`, static assets) pass through.
- [ ] Middleware **only checks cookie presence and signature**, not the JWT itself. Full token validation happens in Route Handlers / server components that call `getSession()`. This keeps the Edge middleware cheap and avoids loading `jose` there.
- [ ] In the existing `(authed)` area from TASK-005 (`apps/web/src/app/(authed)/app/page.tsx`), add `requireSession()` and render a minimal "Signed in as {email}" placeholder (replacing or wrapping the stub). This is the landing target after login and gives TASK-007 / TASK-011 a home to build on. **Don't** build the real home screen here — that's TASK-011. Do **not** add a second `app/app/` tree — URL stays `/app`.

### Users table write-through

- [ ] On successful callback, upsert `users` keyed on `cognito_sub`:
  - If no row: insert `{ cognito_sub, email, display_name: null }`, take the new `id`.
  - If row exists: update `email` if it changed in Cognito; keep everything else. Return the existing `id`.
- [ ] The upsert runs as the `hypercare_app` role via `DATABASE_URL`, not as admin.
- [ ] Put this in `apps/web/src/lib/auth/users.ts` as `upsertUserFromClaims(claims)`. Unit-test it with a mocked Drizzle client — no live DB needed.

### Tests

- [ ] Vitest unit tests for: PKCE challenge generation, cookie sign/verify helpers, ID-token verification (pass + fail cases with `jose` test JWKS), `upsertUserFromClaims` insert vs update paths.
- [ ] One Playwright E2E against local dev: visit `/app`, get bounced to Cognito Hosted UI (assert the redirect target's host and the presence of `code_challenge`), simulate the callback with a signed test token by running a local OIDC stub **or** skip the Hosted UI step and POST a crafted callback directly — pick one and document in the PR. The point of the E2E in v1 is to prove the callback→session→protected-route path, not to drive the real Hosted UI.

### Documentation

- [ ] `docs/adr/0004-auth-session-model.md` — records: why opaque signed cookie vs stateless-JWT-in-cookie; why no silent refresh in v1; why PKCE with a confidential client; why middleware does cookie-only check. (Number follows `0003-design-tokens-and-crisis-strip.md`.)
- [ ] `docs/auth-runbook.md` — how to rotate `SESSION_COOKIE_SECRET`, how to put `COGNITO_APP_CLIENT_SECRET` into Amplify Hosting's env + Secrets Manager for dev, how the local dev loop works (`.env.local` for non-secret values; client secret via `aws secretsmanager get-secret-value` piped through `direnv` or equivalent — PM-operator step, **not** Cursor). Cross-link from `docs/auth-contract.md`.

### Lint / typecheck / tests / build

- [ ] `pnpm lint && pnpm typecheck && pnpm -r build && pnpm test` — green at the repo root, zero warnings.

## Files you will likely create / touch

```
apps/web/
  package.json                         (new deps)
  middleware.ts                        (route protection)
  src/
    lib/
      env.server.ts                    (validated server env incl. client secret)
      env.client.ts                    (validated public env subset)
      auth/
        config.ts                      (Amplify v6 config)
        session.ts                     (getSession / requireSession / set / clear)
        cookie.ts                      (sign / verify helper)
        pkce.ts                        (verifier + challenge)
        users.ts                       (upsertUserFromClaims)
        jwks.ts                        (cached remote JWKS)
    app/
      api/
        auth/
          login/route.ts
          callback/route.ts
          logout/route.ts
          me/route.ts
      auth/
        error/page.tsx                 (error surface)
      (authed)/
        app/
          page.tsx                     (extend TASK-005 stub; requireSession + placeholder)
  test/
    auth/
      cookie.test.ts
      jwks.test.ts
      pkce.test.ts
      users.test.ts
    e2e/
      auth.spec.ts                     (Playwright)
.env.example                           (add new entries with comments)
docs/
  adr/0004-auth-session-model.md
  auth-runbook.md
```

## Out of scope — do not do these here

- Any UI beyond the `/auth/error` surface and the `/app` placeholder. The real home screen is TASK-011; onboarding is TASK-007.
- The main-project → Hypercare token-bridge handoff. `docs/auth-contract.md` explicitly defers this; v1 users re-sign in at the Hosted UI.
- Silent refresh / rolling sessions. Sprint 2.
- Role/permission modeling. Every authenticated user has the same capabilities in v1.
- Route-Level Security in Postgres. App-layer enforcement only in sprint 1 (see TASK-004's "Out of scope").
- Editing `packages/db` schema. The `users` table exists already; this ticket only writes to it.
- Provisioning the `hypercare_app` role or its password. That's a PM operator step from TASK-004; this ticket consumes `DATABASE_URL` and trusts it points at the app role.

## How the PM will verify

1. `pnpm install` at repo root — clean.
2. `pnpm lint && pnpm typecheck && pnpm test && pnpm -r build` — green.
3. Populate `apps/web/.env.local` with the values from `docs/auth-contract.md` plus the client secret pulled from Secrets Manager by the PM. `pnpm --filter web dev`.
4. In an incognito browser, hit `http://localhost:3000/app` → should 302 to Cognito Hosted UI. Sign in with a test account on the shared pool → lands back on `http://localhost:3000/app` showing "Signed in as …".
5. Inspect the cookie: `hc_session` exists, `HttpOnly`, `Secure=false` on localhost, signed body; no Cognito access/refresh token in the cookie.
6. Query the dev DB (as admin via SSM tunnel, or via `hypercare_app`): `SELECT cognito_sub, email FROM users ORDER BY created_at DESC LIMIT 1;` — shows the signed-in user. Sign in again with the same account — no duplicate row; `updated_at` advances.
7. Hit `/api/auth/logout` → cookie cleared, redirected through Cognito's `/logout`, landed at the allowed sign-out URL. `/app` now 302s to `/api/auth/login`.
8. Break it on purpose: delete `COGNITO_APP_CLIENT_SECRET` from env → `pnpm --filter web dev` exits at boot with a `zod` error naming the missing variable. (This proves §5's "fail loud on missing env" rule is actually wired.)
9. Playwright: `pnpm --filter web test:e2e` — passes.

## Decisions Cursor will make and report

- **Session TTL** — default 8 hours; justify in the ADR if you pick something shorter/longer.
- **E2E strategy** — local OIDC stub vs. crafted-callback shortcut. Either is acceptable; name the choice.
- **Amplify Auth v6's role** — you may find that for the OAuth code + client-secret flow you don't actually need `aws-amplify` on the server at all, and raw `fetch` to `/oauth2/token` + `jose` is simpler. **This is acceptable** — if you keep `aws-amplify` only for a future client-side `Auth.signOut()` helper, say so; if you drop it entirely, also fine. Justify in the PR.
- **Cookie format** — signed JSON vs JWT-format. Either works; signed JSON is simpler, a JWT gives you structured `exp`. Pick one.

## Security reminders (PROJECT_BRIEF §8)

- The Cognito client secret **never** flows through Cursor's shell, editor, or logs. Verify its presence with `aws secretsmanager describe-secret` only.
- Do not paste any token, ID, or secret value into a test, fixture, or docstring. Tests use freshly generated key material (`jose.generateKeyPair`).
- If something leaks, stop, prefix the next message with `SECURITY: <what leaked, where>`, and let the PM rotate.

## Report-back template

Use the format in `PROJECT_BRIEF.md §7`. Include in the report:

- Amplify Auth v6 exact version used (or a note if you dropped the dep).
- The four env-to-callback-URL mappings you implemented, to double-check they match `docs/auth-contract.md` exactly.
- The chosen session TTL, cookie format, and E2E strategy.
- A screenshot or cURL trace of the Hosted UI redirect showing `code_challenge` present (proof PKCE is on).
- Anything about the main-project token-bridge that came up and should inform a sprint-2 ticket.
