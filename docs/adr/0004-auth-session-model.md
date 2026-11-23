# ADR 0004 — Opaque signed session cookie (Hypercare, TASK-006)

## Status

Accepted (Sprint 1).

## Context

Hypercare uses AWS Cognito (shared pool) with a **confidential** app client. Users sign in through Hosted UI; the app receives an authorization `code` on `/api/auth/callback`, exchanges it server-side for ID/access tokens, then establishes an **application session** for Next.js server components and route handlers. We need a trustworthy `userId` (Postgres) and `cognitoSub` for downstream tasks (onboarding, conversations, safety audit) without building a second identity system (PRD §4).

## Decisions

### 1. Opaque HMAC-signed cookie, not a stateless Cognito ID JWT in the browser

We store a short JSON payload in `hc_session`, signed with `SESSION_COOKIE_SECRET` (HMAC-SHA256) using Web Crypto, server-side only. We **do not** place Cognito’s ID or access token in the cookie. Rationale: smaller attack surface, no JWT parsing in the browser, easy rotation of the app secret, and a single clear revocation story (drop or rotate the session secret or shorten TTL).

**Session TTL (v1):** 8 hours (default). Re-auth via `/api/auth/login` when it expires. No refresh-token loop in the browser in Sprint 1.

### 2. No silent refresh in v1

Refresh tokens and rolling sessions are **out of scope** until pain shows up. When the session expires, users go through the Hosted UI again. A future sprint can add server-side refresh using stored refresh tokens, but that is not in TASK-006.

### 3. PKCE (S256) even with a client secret

Cognito is configured for authorization code; we always send `code_verifier` / `code_challenge` on `/oauth2/authorize` and `/oauth2/token` alongside HTTP Basic auth for `client_id` + `client_secret`. Rationale: defense in depth, aligns with `docs/auth-contract.md` and public OAuth best practice for hybrid apps.

### 4. Middleware: cookie + signature + `exp` only

Edge middleware does **not** import `jose` or call Cognito JWKS. It only checks that `hc_session` is present, HMAC-valid, and not past `exp` (see `src/lib/auth/middleware-edge.ts`). Full ID-token validation and DB upsert happen in Route Handlers and server code paths that already run in Node. This keeps middleware small and fast.

## Consequences

- **Rotation:** Rotating `SESSION_COOKIE_SECRET` logs everyone out. Documented in `docs/auth-runbook.md`.
- **Amplify library:** The repo pins `aws-amplify` 6.x and exports `AMPLIFY_AUTH_CONFIG` for a single config source of truth. The server OAuth flow is implemented with `fetch` to `/oauth2/token` + `jose` because the code+secret path is server-native; Amplify is reserved for any future client-side helpers, not required for the current routes.

## Related

- `docs/auth-contract.md` — pool, client, URLs, scopes.
- `docs/auth-runbook.md` — operator steps (secrets, local dev, rotation).
- `docs/adr/0001-shared-cognito-with-main-project.md` — why shared pool.
- `docs/adr/0007-build-tool.md` — production build uses Webpack; dev uses Turbopack (manifest / `next start` constraint as of Next 15.5.15).
