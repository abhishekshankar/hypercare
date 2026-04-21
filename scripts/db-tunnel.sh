#!/usr/bin/env bash
set -euo pipefail

# Port-forward Aurora Postgres via the dev stack bastion (TASK-003).
# Prerequisites: AWS CLI, Session Manager plugin, deployed HypercareData-dev stack.
#
# Override defaults:
#   STACK_NAME, LOCAL_PORT, REMOTE_PORT, AWS_REGION, AWS_PROFILE

STACK_NAME="${STACK_NAME:-HypercareData-dev}"
LOCAL_PORT="${LOCAL_PORT:-15432}"
REMOTE_PORT="${REMOTE_PORT:-5432}"
AWS_REGION="${AWS_REGION:-${CDK_DEFAULT_REGION:-ca-central-1}}"

export AWS_REGION

echo "Resolving outputs from stack: ${STACK_NAME} (${AWS_REGION})" >&2

BASTION_ID="$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='BastionInstanceId'].OutputValue" \
  --output text)"

RDS_HOST="$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='ClusterEndpoint'].OutputValue" \
  --output text)"

if [[ -z "${BASTION_ID}" || "${BASTION_ID}" == "None" ]]; then
  echo "Could not read BastionInstanceId from stack outputs." >&2
  exit 1
fi

if [[ -z "${RDS_HOST}" || "${RDS_HOST}" == "None" ]]; then
  echo "Could not read ClusterEndpoint from stack outputs." >&2
  exit 1
fi

echo "Bastion: ${BASTION_ID}" >&2
echo "Remote:  ${RDS_HOST}:${REMOTE_PORT} -> localhost:${LOCAL_PORT}" >&2
echo "Leave this running. In another shell: psql \"postgres://hypercare_admin:<password>@localhost:${LOCAL_PORT}/hypercare_dev\"" >&2
echo >&2

exec aws ssm start-session \
  --region "${AWS_REGION}" \
  --target "${BASTION_ID}" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"${RDS_HOST}\"],\"portNumber\":[\"${REMOTE_PORT}\"],\"localPortNumber\":[\"${LOCAL_PORT}\"]}"
