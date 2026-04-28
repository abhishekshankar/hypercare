#!/usr/bin/env bash
# Deploy the web app to AWS (OpenNext Lambda + CloudFront) per docs/infra-runbook.md.
# Prereq: AWS CLI v2 + CDK bootstrap for ca-central-1; apps/web/.env.local has Cognito + secrets used at synth.
#
# After this script:
#   1. Run DB migrations against the same DB the stack uses (never reset; migrate only):
#        DATABASE_URL='…' pnpm --filter @alongside/db migrate
#      (often via ./scripts/db-tunnel.sh to Aurora, then paste app DATABASE_URL.)
#   2. Re-publish heavy pilot modules so `module_branch_chunks` is populated for branch-aware RAG.
#   3. Confirm Cognito callback + sign-out URLs include the printed CloudFront origin (post-deploy-web prints them).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export AWS_REGION="${AWS_REGION:-ca-central-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ca-central-1}"
export CDK_DEFAULT_REGION="${CDK_DEFAULT_REGION:-ca-central-1}"
export CDK_DEFAULT_ACCOUNT="${CDK_DEFAULT_ACCOUNT:-$(aws sts get-caller-identity --query Account --output text)}"

STACK="${1:-HypercareWeb-dev}"

echo "==> Workspace packages (emit dist)"
pnpm -r --filter './packages/*' run build

echo "==> Next.js production build (apps/web)"
pnpm --filter web build

echo "==> OpenNext bundle (required for CDK asset)"
pnpm --filter web exec open-next build

echo "==> CDK deploy ${STACK}"
(cd infra && pnpm exec cdk deploy "${STACK}" --require-approval never)

echo "==> Post-deploy: AUTH_BASE_URL / AUTH_SIGNOUT_URL on SSR Lambda"
./infra/scripts/post-deploy-web.sh "${STACK}"

echo ""
echo "CloudFront URL:"
OPEN_BROWSER=0 ./scripts/open-hosted-app.sh || true

cat <<EOF

Next (manual):
  - pnpm --filter @alongside/db migrate   # with DATABASE_URL for this stack's DB
  - Re-publish heavy modules for branch chunks if needed
  - Cognito: add the CloudFront URL to app client callback + sign-out URLs if not already set
EOF
