#!/usr/bin/env bash
# Post-deploy step for the deployed web stack (default: legacy HypercareWeb-dev): writes the resolved CloudFront
# URL into the SSR Lambda's AUTH_BASE_URL / AUTH_SIGNOUT_URL env vars.
#
# Why this isn't in CDK: setting these at synth time would create a circular
# CFN dependency (CloudFront depends on Lambda Function URL → Lambda → env →
# CloudFront domain). A custom resource could do it, but a plain script is
# easier to reason about and to re-run if you tear down + redeploy CloudFront.
#
# Idempotent: re-runs are safe.

set -euo pipefail

STACK="${1:-HypercareWeb-dev}"
# First arg is the CDK/CFN stack name, not an env nickname. "dev" is a common mistake.
if [[ "$STACK" == "dev" ]]; then
  STACK="HypercareWeb-dev"
fi
REGION="${AWS_REGION:-${CDK_DEFAULT_REGION:-ca-central-1}}"

echo "Reading stack outputs from $STACK ($REGION)..."

CF_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" \
  --output text)

FN_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ServerFunctionName'].OutputValue" \
  --output text)

if [[ -z "$CF_URL" || -z "$FN_NAME" ]]; then
  echo "FATAL: stack outputs missing CloudFrontUrl or ServerFunctionName" >&2
  exit 1
fi

echo "  CloudFront URL : $CF_URL"
echo "  SSR Lambda     : $FN_NAME"

CURRENT=$(aws lambda get-function-configuration \
  --function-name "$FN_NAME" --region "$REGION" \
  --query "Environment.Variables" --output json)

NEW=$(echo "$CURRENT" | jq --arg url "$CF_URL" \
  '. + {AUTH_BASE_URL: $url, AUTH_SIGNOUT_URL: $url}')

# update-function-configuration is async w.r.t. the function update; poll until
# LastUpdateStatus is Successful so subsequent invocations definitely see the
# new env (otherwise the first request after deploy can race).
aws lambda update-function-configuration \
  --function-name "$FN_NAME" --region "$REGION" \
  --environment "{\"Variables\":$NEW}" >/dev/null

echo -n "Waiting for Lambda env update to apply"
for _ in $(seq 1 30); do
  STATE=$(aws lambda get-function-configuration \
    --function-name "$FN_NAME" --region "$REGION" \
    --query "LastUpdateStatus" --output text)
  if [[ "$STATE" == "Successful" ]]; then
    echo " ok."
    break
  fi
  echo -n "."
  sleep 1
done

cat <<EOF

Done.

Next steps:
  1. Add this URL to Cognito callback + sign-out URLs in the user-pool client:
       $CF_URL/api/auth/callback     (callback)
       $CF_URL                       (sign-out)
  2. Smoke test:
       curl -sI "$CF_URL"
     Expect: HTTP/2 200 with a 'server:' header (not 'x-cache: Error from cloudfront').
  3. CloudFront takes a few minutes to propagate the first time; if you get 503
     immediately after deploy, wait 2-3 min and try again.

EOF
