# Infrastructure names vs. product rebrand (Alongside)

The product and npm packages are **Alongside**. Some **AWS and Postgres identifiers** may still use historical `Hypercare*` names. That is intentional for **brownfield** environments.

## Brownfield (existing deploys)

- **CloudFormation stack IDs** (e.g. `HypercareData-dev`, `HypercareWeb-dev`) are immutable identifiers. Renaming the construct ID in CDK creates a **new** stack, not a rename — you would run duplicate VPCs, clusters, or Lambdas until you decommission the old stack.
- **Aurora database names** (`hypercare_dev`, `hypercare_prod`) and **roles** (`hypercare_admin`, `hypercare_app`) are whatever was created at bootstrap. Changing them in code alone breaks `DATABASE_URL` and client credentials until operators migrate data and secrets.
- **Custom resource type** in the data stack (`Custom::HypercareDatabaseBootstrap`) is left as-is to avoid an unintended replacement of the bootstrap custom resource in production.

Keep using the existing stack names, outputs, and connection strings in `infra/bin/infra.ts` and runbooks until a planned cutover.

## Greenfield (new account / new region)

For a net-new deploy, you may choose new stack names (e.g. `AlongsideData-dev`), new DB name prefixes, and new CDK `resourceType` strings — at the cost of a one-time bootstrap path that does not need to match legacy resources.

## Tags

New taggable resources use `app=alongside` in CDK (`TAG_APP` in `infra/lib/*-stack.ts`). Old resources may still show `hypercare` in tags until recreated.
