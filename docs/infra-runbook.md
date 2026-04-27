# Alongside — infrastructure runbook (dev data stack)

This runbook brings up **HypercareData-dev** (legacy stack name; product is Alongside — see [infra-rename.md](infra-rename.md)): a VPC, Aurora PostgreSQL Serverless v2 with `pgvector`, an SSM bastion for local access, and a one-shot bootstrap that creates `hypercare_dev` / `hypercare_prod` plus the `vector` extension. Schema and app wiring are separate tickets (TASK-004+).

## Prerequisites

- **AWS account** with permissions to create VPC, EC2, RDS, Secrets Manager, Lambda, IAM, CloudWatch Logs, and CloudFormation stacks.
- **AWS CLI v2** configured (`aws configure` or environment variables). Prefer a named profile, e.g. `export AWS_PROFILE=your-profile`.
- **Session Manager plugin** for the AWS CLI (required for `./scripts/db-tunnel.sh` and `aws ssm start-session`). [Install guide](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html).
- **Default Region** `ca-central-1` (matches `docs/auth-contract.md`). The CDK app defaults `CDK_DEFAULT_REGION` to `ca-central-1` when unset. For **deploy and bootstrap**, also set `AWS_REGION` / `AWS_DEFAULT_REGION` to `ca-central-1` so asset publishing and the CDK bootstrap SSM lookup use the same region (otherwise the CLI may default to another region and fail with “environment not bootstrapped”).
- **CDK bootstrap** once per account/region (from repo root):

  ```bash
  pnpm --filter infra cdk bootstrap aws://<your-account-id>/ca-central-1
  ```

  Substitute your account ID (`aws sts get-caller-identity --query Account --output text`). Use the same profile/region you will use for deploy.

- **Node 20+** and **pnpm** (repo root).

## Why not RDS Data API?

The HTTP **RDS Data API** avoids a network tunnel, but **it does not support `pgvector` operators** used for similarity search. Alongside keeps a normal PostgreSQL protocol path (bastion + `psql` / app).

## Deploy

From the **repository root**:

```bash
pnpm install
export AWS_REGION=ca-central-1 AWS_DEFAULT_REGION=ca-central-1
export CDK_DEFAULT_REGION=ca-central-1
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
pnpm --filter infra cdk deploy HypercareData-dev
```

### End-to-end smoke (bootstrap → tunnel → `psql`)

After a **first-time** bootstrap in this account/region, typical flow:

```bash
export AWS_REGION=ca-central-1 AWS_DEFAULT_REGION=ca-central-1
pnpm --filter infra cdk bootstrap aws://<your-account-id>/ca-central-1   # only once per account/region
pnpm --filter infra cdk deploy HypercareData-dev
./scripts/db-tunnel.sh
```

In a **second** terminal (password = JSON `password` from Secrets Manager for the stack secret; see `SecretArn` in stack outputs):

```bash
psql "postgres://hypercare_admin:<password-from-secrets-manager>@localhost:15432/hypercare_dev" -c '\l'
psql "postgres://hypercare_admin:<password-from-secrets-manager>@localhost:15432/hypercare_dev" -c '\dx'
psql "postgres://hypercare_admin:<password-from-secrets-manager>@localhost:15432/hypercare_prod" -c '\dx'
```

Expect `\l` to list `hypercare_dev` and `hypercare_prod`, and `\dx` on each DB to include `vector` after the bootstrap custom resource succeeds.

### Retention cron (TASK-032)

After deploy, run a **dry run** against the target database (from a machine with `DATABASE_URL`):

```bash
pnpm --filter @alongside/db retention:cron -- --dry-run
```

Review the per-table counts, then enable a **daily** schedule (recommended: EventBridge rule → Lambda invoking the same script without `--dry-run`). First non-dry run should be executed manually by PM after verification. CloudWatch: log lines use the `retention.rows_deleted{table=…}` pattern for metric filters.

Notes:

- First deploy can take **15–25 minutes** (Aurora creation).
- The master password is in **Secrets Manager** (CDK-generated secret for user `hypercare_admin`). TASK-004 introduces a least-privilege app user; do not bake the admin password into the repo.

### Outputs

After deploy, the CLI prints stack outputs. You should see:

- `ClusterEndpoint`, `ClusterPort`, `ClusterReaderEndpoint`
- `SecretArn`, `DbNameDev`, `DbNameProd`
- `VpcId`, `BastionInstanceId`

## Hosted web app (`HypercareWeb-dev`) — all traffic in AWS

Use this path when you want the **browser → CloudFront → Lambda → Aurora** stack only. No local `next dev` and no SSM DB tunnel for **using** the app (the SSR function reaches Aurora inside the VPC).

**Prerequisites:** `HypercareData-dev` is deployed; web image is built from OpenNext output.

From the **repository root**:

```bash
export AWS_REGION=ca-central-1 AWS_DEFAULT_REGION=ca-central-1
export CDK_DEFAULT_REGION=ca-central-1
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

pnpm --filter web exec open-next build
cd infra && pnpm exec cdk deploy HypercareWeb-dev
```

Then wire auth URLs into the SSR Lambda and Cognito:

```bash
cd ..   # back to repo root
./infra/scripts/post-deploy-web.sh
```

Follow the script’s printed **Next steps** (Cognito callback `…/api/auth/callback` and sign-out URL). Smoke (expect `HTTP/2 200` and a `server:` header):

```bash
CF=$(aws cloudformation describe-stacks --stack-name HypercareWeb-dev --region ca-central-1 \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" --output text)
curl -sI "$CF"
```

**Open the app in a browser:** `./scripts/open-hosted-app.sh` (see repo `README.md`).

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

4. Fetch the password (JSON field `password`) from Secrets Manager using `SecretArn` from outputs, then run the `psql` lines in **End-to-end smoke** above (or set `DATABASE_URL` and reuse it).

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

## Application database role (`hypercare_app`) — TASK-004

The Aurora admin user `hypercare_admin` is for operators and migrations only. The web app and workers should connect as a least-privilege role.

**Do not** generate or log passwords in automation. The PM (or delegate) performs these steps:

1. Start the SSM tunnel (`./scripts/db-tunnel.sh`) and connect with `hypercare_admin` as today.
2. Create the role and set a strong password (use your password manager; paste only into the session):

   ```sql
   CREATE ROLE hypercare_app LOGIN PASSWORD '<pm-provided>';
   ```

3. Run `packages/db/scripts/bootstrap-app-role.sql` **twice** — once with `psql` connected to `hypercare_dev`, and once connected to `hypercare_prod` (same file; grants are idempotent across runs).

4. Store the password in **AWS Secrets Manager** as a **new** secret dedicated to `hypercare_app` (separate from the CDK admin secret). Use `aws secretsmanager describe-secret` to confirm creation; do not print secret values (see `PROJECT_BRIEF.md` §8).

5. Record the new secret **ARN** in internal environment documentation. In `.env.example`, `DATABASE_URL` is commented to remind developers that the app connection string should use `hypercare_app` + the tunneled host/port once that secret is available.

**Verify:** as `hypercare_app`, `SELECT 1 FROM users LIMIT 1;` should succeed after migrations; `DROP TABLE users;` should fail with a permission error.

## `DATABASE_URL_ADMIN` (content loader) — TASK-008

The **content loader** (`@alongside/content`, `pnpm --filter @alongside/content load`) is an **operator** tool, not the web app. It seeds `modules` and `module_chunks` (including embeddings) and is allowed to use the **Aurora admin** user, same as ad-hoc `psql` and migration runs.

- **Variable:** set `DATABASE_URL_ADMIN` in your environment to a `postgres://` or `postgresql://` URL (same shape as a normal `DATABASE_URL`).
- **Example (with tunnel):** after `./scripts/db-tunnel.sh`, the host is `127.0.0.1` and the local port (often `15432` per this runbook) maps to the cluster. The **username** is `hypercare_admin`. The **password** is the JSON field `password` in the **CDK `SecretArn`** for the data stack, retrieved only through your own session (e.g. AWS Console, AWS CLI) — do **not** log it, print it in automation, or commit it. The **database** name is typically `hypercare_dev` or `hypercare_prod` from stack outputs.
- **If `DATABASE_URL_ADMIN` is unset:** the loader prints a short error and exits; it does **not** read Secrets Manager for you. Paste the URL from your password manager or shell `export` after you have opened the tunnel and copied the password securely.

## Seeding content (pilot modules)

1. Ensure migrations have been applied to the target database (`packages/db`).
2. Start the SSM port forward (`./scripts/db-tunnel.sh`), then export `DATABASE_URL_ADMIN` (see above).
3. Set AWS credentials in `ca-central-1` (e.g. `aws sso login`) and enable model access in Bedrock for **Titan Text Embeddings V2** if your account requires it.
4. From the **repository root**:
   ```bash
   pnpm --filter @alongside/content load
   ```
5. The loader reads `content/modules/*.md`, validates front matter, chunks, calls Bedrock, and upserts. A **second** run is idempotent (hash-based embedding skips) — see `docs/adr/0006-content-pipeline-v0.md`.

## Troubleshooting

- **`cdk deploy` cannot assume lookup role**: Ensure the account/region matches where you bootstrapped, and credentials are for the same account.
- **Bootstrap Lambda fails**: Check CloudWatch Logs for `/aws/lambda/<DbBootstrapOnEvent...>` — often the cluster is still provisioning; redeploy or wait and update the stack.
- **Session Manager tunnel fails**: The bastion instance profile must allow SSM; `BastionHostLinux` includes this. Confirm the instance is **running** and your IAM user can start sessions. If you see `SessionManagerPlugin is not found`, install the [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html).
