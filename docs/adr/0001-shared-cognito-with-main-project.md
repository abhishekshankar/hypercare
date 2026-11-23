# ADR 0001 — Shared Cognito user pool with the main project

## Status

Accepted

## Context

Hypercare must authenticate caregivers without owning a separate identity system. The **main project** already operates an AWS Cognito user pool for the same user population. Hypercare is a **second application client** on that pool (`PROJECT_BRIEF.md` §4).

Alternatives considered:

1. **Shared Cognito user pool (chosen)** — One pool, multiple app clients; Hosted UI / OAuth redirects; JWKS validation against `cognito-idp.<region>.amazonaws.com/<poolId>`.

2. **JWT bridge** — Main project issues short-lived tokens signed with a key Hypercare trusts; Hypercare never talks to Cognito directly. **Trade-off:** Extra token format, rotation, and trust wiring; duplicates validation logic unless carefully shared.

3. **OIDC relying party only** — Hypercare acts as RP to an external IdP without using Cognito’s app client model for this pool. **Trade-off:** Misaligned with “second app client on existing pool” and adds abstraction without simplifying ops for this codebase.

## Decision

Use the **existing Cognito user pool** in **`ca-central-1`** with a **dedicated Hypercare app client** (`2s4r9um36h654ehst7665vhsij` at TASK-002 handoff). Configure **Amplify Auth v6** (TASK-006) and **server-side JWT validation** via the documented **JWKS URL**. Do **not** provision a new user pool in Hypercare’s CDK.

## Consequences

**Positive**

- Single source of truth for users; no duplicate accounts for the same person.
- Standard Cognito OIDC/JWKS validation on the server.
- Operational ownership of the pool stays with the main project’s AWS account and processes.

**Negative / mitigations**

- **Coupling:** Pool ID, region, app client settings, and Hosted UI domain are contract inputs; changes in the main project require updates to `docs/auth-contract.md` and Hypercare env/config.
- **App client hygiene:** Callback/sign-out URLs and public-vs-confidential client choices must be correct for browser + PKCE; misconfiguration blocks local or prod sign-in.
- **Delegated UX:** Users may re-authenticate via Hosted UI for v1 unless a token handoff is added later (documented in `docs/auth-contract.md`).

## References

- `PROJECT_BRIEF.md` §4 — Auth integration with the other project
- `docs/auth-contract.md` — Concrete pool, client, URLs, and constraints
