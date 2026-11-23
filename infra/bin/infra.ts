#!/usr/bin/env node
/**
 * CDK app entry. Stack IDs `HypercareData-dev` / `HypercareWeb-dev` and ARNs/hosts
 * below match **existing** brownfield deploys. Renaming them creates new
 * CloudFormation stacks (and possibly duplicate infra); see docs/infra-rename.md.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import * as cdk from "aws-cdk-lib";

import { DataStack } from "../lib/data-stack";
import { WebStack } from "../lib/web-stack";

const app = new cdk.App();

const region = process.env.CDK_DEFAULT_REGION ?? "ca-central-1";
const account = process.env.CDK_DEFAULT_ACCOUNT;
const env: cdk.Environment = account ? { account, region } : { region };

new DataStack(app, "HypercareData-dev", {
  env,
  description: "Alongside dev: Aurora Serverless v2 + pgvector bootstrap + SSM bastion",
});

// ----- Web stack (HypercareWeb-dev): Next.js SSR via OpenNext on Lambda + CloudFront -----
//
// Imports the data stack's VPC + DB secret by ID/ARN (rather than cross-stack
// references) so the two stacks can be deployed and destroyed independently.
// The IDs below are the deterministic outputs of the existing
// `HypercareData-dev` stack in account 842676017161 / ca-central-1; if that
// stack is recreated, refresh these values from `aws cloudformation describe-stacks`.

const repoRoot = path.resolve(__dirname, "..", "..");
const webRoot = path.join(repoRoot, "apps", "web");

function loadEnvFile(p: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(p)) return out;
  const text = fs.readFileSync(p, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip surrounding quotes (matching dotenv behaviour) so secrets like
    // SESSION_COOKIE_SECRET aren't double-quoted in the Lambda env.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function requireEnv(env: Record<string, string>, key: string): string {
  const v = env[key] ?? process.env[key];
  if (!v) {
    throw new Error(
      `Missing required env var ${key}. Expected in apps/web/.env.local or process.env. Run \`./scripts/db-tunnel.sh\` once and copy your Cognito + session secret values into .env.local first.`,
    );
  }
  return v;
}

const dotenv = loadEnvFile(path.join(webRoot, ".env.local"));

new WebStack(app, "HypercareWeb-dev", {
  env,
  description: "Alongside dev: Next.js SSR via OpenNext on Lambda + CloudFront",
  vpcId: "vpc-0f2dad90b0f678105",
  dbSecretArn:
    "arn:aws:secretsmanager:ca-central-1:842676017161:secret:HypercareDatadevDatabaseClu-AivEHTsPYQF4-eKhC8O",
  dbHost:
    "hypercaredata-dev-databasecluster68fc2945-bdlwtjwhndct.cluster-c56cc0u08yhy.ca-central-1.rds.amazonaws.com",
  dbPort: 5432,
  dbName: "hypercare_dev",
  cognito: {
    userPoolId: requireEnv(dotenv, "COGNITO_USER_POOL_ID"),
    appClientId: requireEnv(dotenv, "COGNITO_APP_CLIENT_ID"),
    appClientSecret: requireEnv(dotenv, "COGNITO_APP_CLIENT_SECRET"),
    domain: requireEnv(dotenv, "COGNITO_DOMAIN"),
    region: requireEnv(dotenv, "COGNITO_REGION"),
  },
  sessionCookieSecret: requireEnv(dotenv, "SESSION_COOKIE_SECRET"),
  webRoot,
});

app.synth();
