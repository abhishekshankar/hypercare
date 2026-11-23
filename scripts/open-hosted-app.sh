#!/usr/bin/env bash
set -euo pipefail

# Print (and optionally open) the public app URL from HypercareWeb-dev outputs.
# Use this when you want to run the product entirely on AWS — no local next dev
# or SSM DB tunnel required in the browser.

STACK_NAME="${STACK_NAME:-HypercareWeb-dev}"
AWS_REGION="${AWS_REGION:-${CDK_DEFAULT_REGION:-ca-central-1}}"

export AWS_REGION

echo "Reading CloudFrontUrl from stack: ${STACK_NAME} (${AWS_REGION})" >&2

CF_URL="$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" \
  --output text)"

if [[ -z "${CF_URL}" || "${CF_URL}" == "None" ]]; then
  echo "FATAL: stack ${STACK_NAME} has no CloudFrontUrl output (deploy HypercareWeb-dev first)." >&2
  exit 1
fi

echo "${CF_URL}"

if [[ "${OPEN_BROWSER:-1}" == "1" ]]; then
  case "$(uname -s)" in
    Darwin) open "${CF_URL}" ;;
    Linux)
      if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "${CF_URL}" >/dev/null 2>&1 || true
      fi
      ;;
  esac
fi
