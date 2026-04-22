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
| **App client name (Cognito console)** | `hypercare` |
| **Client secret** | **Yes** — a client secret exists on this app client (value is **not** stored in this repo; use AWS console / Secrets Manager / env at runtime only). For a browser/Next.js app using **PKCE**, this is acceptable if the secret is used only in **server-side** auth config (e.g. NextAuth) and **never** exposed to the browser. *Optional later:* create a **public** app client (no secret) if you want to align strictly with SPA + PKCE patterns — **not blocking**. |

## OAuth configuration (as configured in Cognito)

| Field | Value |
|--------|--------|
| **OAuth flows** | **Authorization code grant** (only flow listed). PKCE is not a separate toggle in the current Cognito console; enforce PKCE in the app/SDK (TASK-006). |
| **OAuth scopes** | `openid`, `email`, `phone`, `profile` |

## Hypercare deployment URLs (user labels **a** / **b**)

These labels refer to **where Hypercare is hosted**, not to the token-bridge flow options in **Token-bridge / handoff** below.

| Label | Role | Base URL |
|-------|------|----------|
| **a** | AWS Amplify (main branch app) | `https://main.d1ajzemw7s1n5f.amplifyapp.com` |
| **b** | Production (path on cogcare.org) | `https://cogcare.org/care1` |

## Callback and sign-out URLs (as configured in Cognito)

**Allowed callback URLs** (4 total):

| URL | Purpose |
|-----|---------|
| `https://d84l1y8p4kdic.cloudfront.net` | CloudFront (existing) |
| `http://localhost:3000/api/auth/callback` | Local dev |
| `https://main.d1ajzemw7s1n5f.amplifyapp.com/api/auth/callback` | Amplify (**a**) |
| `https://cogcare.org/care1/api/auth/callback` | Production (**b** app path) |

**Allowed sign-out URLs** (3 total):

| URL | Purpose |
|-----|---------|
| `http://localhost:3000` | Local dev |
| `https://main.d1ajzemw7s1n5f.amplifyapp.com` | Amplify (**a**) |
| `https://cogcare.org` | Production |

Use the same strings in Hypercare and in any OAuth client config so redirects match Cognito exactly (including trailing slashes / lack thereof).

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

**None.** The Cognito **Sign-up** experience shows **Custom attributes (0)** — “No custom attributes found” (console: [Hosted UI / app client settings](https://ca-central-1.console.aws.amazon.com/cognito/v2/idp/user-pools/ca-central-1_qvGFxxwDS/applications/app-clients/2s4r9um36h654ehst7665vhsij/login-pages/edit/hosted-ui-settings?region=ca-central-1)). Hypercare does not sync custom pool attributes for v1.

## What Hypercare must **not** do

Delegated-auth rules (see `prd.md` / PRD §4):

- No password fields in the Hypercare UI.
- No signup flow owned by Hypercare.
- No MFA enrollment flows owned by Hypercare.
- No editing of profile fields owned by the main project’s identity surface.

## Action items (Cognito / product)

| Item | Status |
|------|--------|
| OAuth scopes (`profile`, etc.) | Done — see [OAuth configuration](#oauth-configuration-as-configured-in-cognito). |
| Callback / sign-out URLs | Done — see [Callback and sign-out URLs](#callback-and-sign-out-urls-as-configured-in-cognito). |
| Custom attributes | Done — [none](#custom-attributes). |
| Public client (no secret) | **Optional, not blocking** — current confidential client + server-side secret + PKCE is acceptable; see [Hypercare app client](#hypercare-app-client). |

## Operations

- [Auth runbook](auth-runbook.md) — env vars, per-environment `AUTH_BASE_URL` / `AUTH_SIGNOUT_URL`, secret rotation, local dev, Playwright scope.
- [ADR 0004 — session model](adr/0004-auth-session-model.md) — why opaque session cookie, no silent refresh in v1, PKCE with confidential client, middleware scope.
