# TASK-002 — Collect Cognito parameters from the user, document the auth contract

**Owner:** Cursor (drives the conversation; user supplies values)
**Depends on:** —
**Status:** done

## Why this exists

Hypercare's auth is delegated to the main project's existing Cognito user pool (PROJECT_BRIEF §4). Until we have the pool ID, region, and an app client provisioned by the user, no auth ticket can land. This ticket exists to make that handoff explicit and write the contract down so it's not lost in chat.

## What "done" looks like

A committed file `docs/auth-contract.md` that any future contributor can read and understand exactly how Hypercare authenticates against the main project's Cognito user pool — concrete values filled in, not placeholders.

## Acceptance criteria

- [x] `docs/auth-contract.md` exists with these sections, each filled with real values (not `<TODO>`):
  - **User pool ID** and **AWS region**.
  - **Hypercare App Client ID** (a new app client the user creates in the main project's Cognito console specifically for Hypercare).
  - Whether the app client uses a **client secret** (recommended: no — public client + PKCE).
  - **OAuth flows enabled** on the app client (recommended: Authorization code grant + PKCE; refresh tokens enabled).
  - **OAuth scopes** (recommended: `openid email profile`).
  - **Allowed callback URLs** the user has whitelisted on the app client. At minimum: `http://localhost:3000/api/auth/callback`, the Amplify preview branch URL pattern, and the prod URL.
  - **Allowed sign-out URLs**, same shape.
  - **Hosted UI domain** — full URL (e.g., `https://main-project.auth.us-east-1.amazoncognito.com`).
  - **Cognito JWKS URL** (derived from the pool, but write it down).
  - **Token-bridge mechanism** — how a user signed in to the main project arrives at Hypercare already authenticated. Either: (a) Hypercare links to the Hosted UI and the user re-signs (acceptable in v1), or (b) the main project hands off via a one-time code / shared cookie domain. Document whichever the user picks.
  - **Username vs email** — which Cognito attribute is the immutable user identifier we should key our `users` table on. Recommended: the Cognito `sub` claim.
  - **Custom attributes (if any)** the main project sets that we should read or write.
- [x] The same file lists **what Hypercare must NOT do**: no password fields, no signup flow, no MFA enrollment, no profile editing of fields owned by the main project. (PRD §4 — auth is delegated.)
- [x] An ADR at `docs/adr/0001-shared-cognito-with-main-project.md` records the decision and the trade-offs (why shared-pool over JWT-bridge over OIDC-RP).
- [x] PR description explicitly lists which values came from the user vs which were derived/documented by Cursor.

## PM note on the client-secret decision (accepted)

App client was provisioned with a **client secret** instead of the recommended public-client + PKCE shape. This is acceptable for Hypercare because Next.js is SSR and the token exchange will happen server-side, where a confidential-client secret is fine. **TASK-006 is responsible** for:

- storing the client secret in **AWS Secrets Manager** (never in `.env.example`, never in a browser bundle),
- enforcing **PKCE** in the SDK configuration,
- ensuring the secret is read only in the server-side token-exchange handler (Next.js Route Handler), not in any RSC or Client Component.

## How Cursor runs this ticket

This is a "drive the user" ticket, not a coding ticket. Open a chat with the user and ask, **as a numbered list they can answer in one paste**, for the values listed in the acceptance criteria. Then commit the filled-in `docs/auth-contract.md` and the ADR.

If the user does not yet have the Hypercare app client created, give them the exact AWS console click-path to create one against the existing pool. Do not create it yourself — the user owns the main project's AWS account.

## Out of scope — do not do these here

- Any code that reads or validates Cognito tokens. (TASK-006.)
- Installing `aws-amplify`. (TASK-006.)
- Any UI. (TASK-006.)
- Any CDK code. (Cognito is **owned by the main project**; Hypercare's CDK does not declare the pool.)

## How the PM will verify

1. Read `docs/auth-contract.md` — every field has a real value.
2. Open the AWS console with the user, click into the user pool by ID, confirm the Hypercare app client exists with the documented settings.
3. Hit the Hosted UI domain in a browser, confirm it loads.

## Report-back template

Use `PROJECT_BRIEF.md §7`. List the values you collected (redact only the App Client ID if you want to be cautious — but it's not a secret).
