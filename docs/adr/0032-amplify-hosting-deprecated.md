# ADR 0032 — Amplify Hosting deprecated; CloudFront → ALB → OpenNext Lambda is the canonical path

**Status:** Accepted (April 2026)
**Decision-maker:** abhishek
**Supersedes:** the implicit "Amplify is the hosting target" assumption baked into earlier `amplify.yml` work

## Context

The Alongside web app shipped with two parallel hosting paths:

1. **AWS Amplify Hosting** — a managed Next.js SSR hosting product. Configured via `amplify.yml` at the repo root.
2. **Custom CloudFront → ALB → OpenNext Lambda stack** — a hand-rolled CDK stack at `infra/lib/web-stack.ts`. CloudFront sits at the edge, an Application Load Balancer in the VPC enforces an `X-Origin-Verify` shared-secret header to block direct access, and ARM64 container Lambdas (1024 MB SSR + 1536 MB image optimization) run the Next.js standalone bundle. Static assets are S3-backed via origin access control. Aurora is reachable from the Lambdas over private VPC networking.

Path 2 is the **working production path**. It exists *because* path 1 failed.

The failure modes for Amplify Hosting in this AWS account are documented in detail in `CLAUDE.md`:

- **Platform misclassification.** The Amplify console for existing apps does not surface the Platform / Framework dropdowns; an SSR Next.js app gets deployed as static (`platform: WEB`) by default and serves 404 with `server: AmazonS3`. The fix requires CLI updates to platform `WEB_COMPUTE` and framework `Next.js - SSR`.
- **Missing SSR-detection manifests.** Amplify reads `BUILD_ID`, `required-server-files.json`, `routes-manifest.json`, `prerender-manifest.json`, and the `*-manifest.json` family from the `.next/` artifact root to decide whether to provision an SSR compute function. If they are missing or in the wrong path (which happens with monorepo standalone builds where the entry is nested at `.next/standalone/apps/web/`), no compute function is provisioned. The build "succeeds" but the app returns 500 with `x-cache: Error from cloudfront` and no `server:` header.
- **Artifact size limit (~220 MB).** With `output: 'standalone'`, Next.js writes a self-contained server bundle under `.next/standalone/`, while also leaving the redundant `.next/server/` tree in place. Shipping `.next/**/*` ships both — observed at ~440 MB after `.next/cache` cleanup, well over the limit.
- **Account-level Lambda Function URL block.** Independent of Amplify, this account blocks Lambda Function URLs at the policy level. Amplify's SSR compute provisioning relies on Function URLs, which is the deeper reason path 1 silently fails — even when manifests are present and platform is correct, the underlying Function URL is non-grantable.

The custom stack in `infra/lib/web-stack.ts` invokes Lambdas via `lambda:InvokeFunction` from the ALB instead of Function URLs, sidestepping the account-level block entirely.

## Decision

**Amplify Hosting is deprecated as a hosting target for Alongside.** The CloudFront → ALB → OpenNext Lambda stack is the canonical and only supported production path.

The `amplify.yml` build spec, the `apps/web/.next` artifact shape it produces, and any branch-preview wiring in the Amplify console are no longer maintained. The file remains in the repo as historical context (and as a reference for any future operator who attempts to revive Amplify Hosting once AWS resolves the underlying SSR-detection or Function URL gaps in this account).

## Consequences

**What this means in practice:**

- New deployments go to the CloudFront stack via `cd infra && pnpm exec cdk deploy HypercareWeb-dev` (or `-prod`). See `docs/infra-runbook.md`.
- The README's "Use the hosted app" section continues to describe the CloudFront flow; no other path should be added.
- `amplify.yml` carries a deprecation header pointing to this ADR. The file is not deleted because (a) deletion would silently break any branch-preview environments operators may have wired up manually in the Amplify console, and (b) the build spec itself is a useful reference if Amplify is ever revived for branch-preview-only use (option B in §"Future considerations").
- CI does not deploy to Amplify. No GitHub Actions workflow targets Amplify; this remains the case.
- Any Amplify app instances in the AWS account should be either (a) marked deprecated in the console with a description note, or (b) disconnected from the GitHub repo so commits to `main` no longer trigger builds. This is an operator action, not a code change.

**What this does *not* mean:**

- This is not a deletion of the Amplify-related code. The deprecation is a declaration of *unsupported*, not *removed*. Removing `amplify.yml` would close a future option without saving meaningful repo size.
- This is not a statement about Amplify's quality as a product. The failure modes documented above are specific to this AWS account's policies (Function URL block) and to the monorepo standalone-build shape; in a clean account or a single-app repo, Amplify would likely work fine.

## Future considerations

Two scenarios where the decision could be revisited:

**Option A — full revival.** AWS resolves the Function URL block for this account or Amplify changes its SSR-detection mechanism to not require Function URLs. At that point, retiring the custom CDK stack and consolidating on Amplify becomes attractive (less infrastructure to maintain). Trigger: an AWS support ticket resolution or a public Amplify changelog entry. Until then, do not attempt this.

**Option B — Amplify for PR previews only.** Amplify is genuinely good at per-branch ephemeral preview environments, where each pull request gets its own URL. The custom stack does not provide this and CDK would have to be extended to. If branch previews become a real need, reviving Amplify scoped to feature branches (with `main` continuing to deploy via CDK) is a reasonable compromise. Cost: re-investing in the failure-mode debugging documented in `CLAUDE.md`.

Neither option is a near-term priority.

## References

- `CLAUDE.md` § *Amplify Hosting (build succeeds, site is 404)* — the failure-mode catalog
- `infra/lib/web-stack.ts` — the working CDK stack, with provenance comments at lines 8–19 explaining why
- `docs/infra-runbook.md` — operator runbook for the CloudFront stack
- `amplify.yml` — historical build spec, now bearing a deprecation header pointing here
