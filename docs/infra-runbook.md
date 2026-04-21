# Hypercare — infrastructure runbook (dev data stack)

This runbook brings up **HypercareData-dev**: a VPC, Aurora PostgreSQL Serverless v2 with `pgvector`, an SSM bastion for local access, and a one-shot bootstrap that creates `hypercare_dev` / `hypercare_prod` plus the `vector` extension. Schema and app wiring are separate tickets (TASK-004+).

## Prerequisites

- **AWS account** with permissions to create VPC, EC2, RDS, Secrets Manager, Lambda, IAM, CloudWatch Logs, and CloudFormation stacks.
- **AWS CLI v2** configured (`aws configure` or environment variables). Prefer a named profile, e.g. `export AWS_PROFILE=your-profile`.
- **Default Region** `ca-central-1` (matches `docs/auth-contract.md`). The CDK app defaults `CDK_DEFAULT_REGION` to `ca-central-1` when unset.
- **CDK bootstrap** once per account/region:

  ```bash
  pnpm exec cdk bootstrap aws://ACCOUNT_ID/ca-central-1
  ```

  Use your real account ID. If you use a profile: `aws sts get-caller-identity`.

- **Node 20+** and **pnpm** (repo root).

## Why not RDS Data API?

The HTTP **RDS Data API** avoids a network tunnel, but **it does not support `pgvector` operators** used for similarity search. Hypercare keeps a normal PostgreSQL protocol path (bastion + `psql` / app).

## Deploy

From the **repository root**:

```bash
pnpm install
export CDK_DEFAULT_REGION=ca-central-1
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
pnpm --filter infra cdk deploy HypercareData-dev
```

Notes:

- First deploy can take **15–25 minutes** (Aurora creation).
- The master password is in **Secrets Manager** (CDK-generated secret for user `hypercare_admin`). TASK-004 introduces a least-privilege app user; do not bake the admin password into the repo.

### Outputs

After deploy, the CLI prints stack outputs. You should see:

- `ClusterEndpoint`, `ClusterPort`, `ClusterReaderEndpoint`
- `SecretArn`, `DbNameDev`, `DbNameProd`
- `VpcId`, `BastionInstanceId`

## Local database access (SSM port forward)

The cluster has **no public endpoint**. Use **Session Manager** port forwarding via the bastion.

1. Get the bastion instance ID from stack outputs (`BastionInstanceId`) or:

   ```bash
   aws cloudformation describe-stacks \
     --stack-name HypercareData-dev \
     --query "Stacks[0].Outputs[?OutputKey=='BastionInstanceId'].OutputValue" \
     --output text
   ```

2. Get the cluster hostname from `ClusterEndpoint` (or outputs).

3. Start the tunnel (keep this terminal open). From repo root:

   ```bash
   ./scripts/db-tunnel.sh
   ```

   Or manually (replace `i-0123456789abcdef0` and the RDS hostname):

   ```bash
   aws ssm start-session \
     --target i-0123456789abcdef0 \
     --document-name AWS-StartPortForwardingSessionToRemoteHost \
     --parameters '{"host":["YOUR_CLUSTER_ENDPOINT"],"portNumber":["5432"],"localPortNumber":["15432"]}'
   ```

4. Fetch the password (JSON field `password`) from Secrets Manager using `SecretArn` from outputs, then connect:

   ```bash
   export DATABASE_URL="postgres://hypercare_admin:YOUR_PASSWORD@localhost:15432/hypercare_dev"
   psql "$DATABASE_URL" -c '\l'
   psql "$DATABASE_URL" -c '\dx'
   ```

   Expect databases `hypercare_dev` and `hypercare_prod`, and extension `vector` on each after bootstrap succeeds.

## Tagging verification

```bash
CLUSTER_ARN=$(aws rds describe-db-clusters \
  --query "DBClusters[?contains(DBClusterIdentifier,'HypercareData')].DBClusterArn | [0]" \
  --output text)

aws resourcegroupstaggingapi get-resources \
  --resource-arn-list "$CLUSTER_ARN" \
  --query "ResourceTagMappingList[0].Tags" \
  --output table
```

You should see `app=hypercare` and `env=dev`.

## Rollback / destroy

**Destroy** removes the stack (Aurora uses `RemovalPolicy.SNAPSHOT` — a final snapshot may be retained per RDS behavior; confirm in the console).

```bash
pnpm --filter infra cdk destroy HypercareData-dev
```

If destroy fails on dependencies, empty the stack’s S3 buckets or delete retained resources as prompted, then retry.

## Rough monthly cost (dev)

Non-binding estimate in `ca-central-1`:

- Aurora Serverless v2 at **0.5–2 ACU** (variable; scales with load).
- **One NAT gateway** + data processing.
- **One small bastion** (t3.nano or similar, depending on CDK defaults for `BastionHostLinux`).
- **Secrets Manager** secret.

Turn off or destroy the stack when not actively developing to avoid NAT and Aurora charges.

## Troubleshooting

- **`cdk deploy` cannot assume lookup role**: Ensure the account/region matches where you bootstrapped, and credentials are for the same account.
- **Bootstrap Lambda fails**: Check CloudWatch Logs for `/aws/lambda/<DbBootstrapOnEvent...>` — often the cluster is still provisioning; redeploy or wait and update the stack.
- **Session Manager tunnel fails**: The bastion instance profile must allow SSM; `BastionHostLinux` includes this. Confirm the instance is **running** and your IAM user can start sessions.
