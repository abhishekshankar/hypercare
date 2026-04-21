#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DataStack } from "../lib/data-stack";

const app = new cdk.App();

const region = process.env.CDK_DEFAULT_REGION ?? "ca-central-1";
const account = process.env.CDK_DEFAULT_ACCOUNT;
const env: cdk.Environment = account ? { account, region } : { region };

new DataStack(app, "HypercareData-dev", {
  env,
  description: "Hypercare dev: Aurora Serverless v2 + pgvector bootstrap + SSM bastion",
});

app.synth();
