# Hypercare — Auth contract (shared Cognito with main project)

This document records how Hypercare authenticates against the **main project’s** existing AWS Cognito user pool. Values below were supplied at TASK-002 handoff unless marked *derived*.

## User pool and region

| Field | Value |
|--------|--------|
| **Cognito User Pool ID** | `ca-central-1_qvGFxxwDS` |
| **AWS region** | `ca-central-1` (Canada Central) |

## Hypercare app client

| Field | Value |
|--------|--------|
| **App Client ID** | `2s4r9um36h654ehst7665vhsij` |
| **Console name (as of handoff)** | `My web app - 7savq` — rename to **hypercare** in Cognito for clarity. |
| **Client secret** | **Yes** — a client secret exists on this app client (value is **not** stored in this repo; use AWS console / Secrets Manager / env at runtime only). *Recommended for browser/Next.js + PKCE: a **public** app client **without** a secret; consider creating a new client and retiring this one.* |

## OAuth configuration (as configured in Cognito)

| Field | Value |
|--------|--------|
| **OAuth flows** | **Authorization code grant** (only flow listed). PKCE is not a separate toggle in the current Cognito console; enforce PKCE in the app/SDK (TASK-006). |
| **OAuth scopes** | `openid`, `email`, `phone`. **`profile` is not enabled** — add `profile` if Hypercare needs standard name/picture claims. |

## Callback and sign-out URLs (as configured in Cognito)

**Allowed callback URLs** (exactly as whitelisted at handoff):

- `https://d84l1y8p4kdic.cloudfront.net`

**Gaps (required before local dev / Amplify / prod work end-to-end):**

- Add `http://localhost:3000/api/auth/callback` for local development.
- Add Amplify preview callback(s), e.g. `https://main.<app-id>.amplifyapp.com/api/auth/callback` (match your Amplify app).
- Add production callback, e.g. `https://<your-prod-domain>/api/auth/callback`.

**Allowed sign-out URLs** at handoff: **none configured.**

**Minimum recommended sign-out URLs** (to be added in Cognito):

- `http://localhost:3000/`
- Amplify preview origin(s) as needed.
- Production site origin.

## Hosted UI

| Field | Value |
|--------|--------|
| **Hosted UI domain (base URL)** | `https://ca-central-1qvgfxxwds.auth.ca-central-1.amazoncognito.com` |

## JWKS (token validation)

| Field | Value |
|--------|--------|
| **Cognito JWKS URL** (*derived*) | `https://cognito-idp.ca-central-1.amazonaws.com/ca-central-1_qvGFxxwDS/.well-known/jwks.json` |

Server-side validation in Hypercare should use this JWKS URL with the pool’s issuer (`https://cognito-idp.ca-central-1.amazonaws.com/ca-central-1_qvGFxxwDS`).

## Token-bridge / handoff from main project

**Decision for v1:** Hypercare uses the **shared pool’s Hosted UI** (or equivalent OAuth redirect). Users may **sign in again** when entering Hypercare; that is acceptable for v1 per `PROJECT_BRIEF.md` §4.

**Future option:** If the main project implements a **one-time code** or shared-cookie handoff, document the flow in a follow-up task and update this section — no change to the pool ID or app client ID unless the main project dictates otherwise.

## Stable user identifier

**Use the Cognito `sub` claim** as the immutable user identifier for Hypercare’s `users` table (and any foreign keys). Do not use email as the primary key.

## Custom attributes

**Not inventoried at TASK-002.** Confirm in the user pool **Attributes** tab whether any custom attributes exist that Hypercare must read or write; update this section when known.

## What Hypercare must **not** do

Delegated-auth rules (see `prd.md` / PRD §4):

- No password fields in the Hypercare UI.
- No signup flow owned by Hypercare.
- No MFA enrollment flows owned by Hypercare.
- No editing of profile fields owned by the main project’s identity surface.

## Action items (Cognito / product)

| Item | Notes |
|------|--------|
| Rename app client | Prefer name **hypercare** in the console. |
| Public client for browser | Prefer **no client secret** + PKCE for browser; rotate to a new app client if needed. |
| Scopes | Consider adding **`profile`** if claims are required. |
| Callback URLs | Add localhost, Amplify preview, and production callback URLs (see above). |
| Sign-out URLs | Configure at least localhost, preview, and prod origins. |
| Custom attributes | List any pool custom attrs and whether Hypercare syncs them. |
