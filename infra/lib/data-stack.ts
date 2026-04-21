/**
 * Hypercare data plane: VPC, Aurora PostgreSQL Serverless v2 + pgvector bootstrap, SSM bastion.
 *
 * Bootstrap: custom-resource Lambda (CDK Provider) runs CREATE DATABASE + CREATE EXTENSION vector.
 * Alternatives considered: RDS Data API (incompatible with pgvector); extra construct libs avoided
 * for a small, auditable one-shot script.
 *
 * IAM-authenticated / least-privilege DB users: deferred to TASK-004 (Drizzle + migrations).
 */
import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import { Provider } from "aws-cdk-lib/custom-resources";

/** Aurora PostgreSQL 16.6 — pgvector supported on Aurora PostgreSQL (see AWS Aurora release notes). */
const AURORA_PG_VERSION = rds.AuroraPostgresEngineVersion.VER_16_6;

const TAG_APP = "hypercare";
const TAG_ENV = "dev";

export class DataStack extends cdk.Stack {
  public constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("app", TAG_APP);
    cdk.Tags.of(this).add("env", TAG_ENV);

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC },
        { name: "Private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: "Isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    const bastion = new ec2.BastionHostLinux(this, "Bastion", {
      vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const cluster = new rds.DatabaseCluster(this, "DatabaseCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: AURORA_PG_VERSION }),
      credentials: rds.Credentials.fromGeneratedSecret("hypercare_admin"),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      writer: rds.ClusterInstance.serverlessV2("writer", { scaleWithWriter: true }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      storageEncrypted: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      deletionProtection: false,
    });

    cluster.connections.allowDefaultPortFrom(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      "Postgres from VPC (bastion tunnel and future app tiers)",
    );

    const bootstrapSg = new ec2.SecurityGroup(this, "BootstrapLambdaSg", {
      vpc,
      description: "Bootstrap custom resource Lambda → Aurora",
      allowAllOutbound: true,
    });
    cluster.connections.allowDefaultPortFrom(bootstrapSg, "Bootstrap Lambda to cluster");

    const bootstrapFnLogGroup = new logs.LogGroup(this, "DbBootstrapOnEventLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const onEvent = new NodejsFunction(this, "DbBootstrapOnEvent", {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [bootstrapSg],
      handler: "handler",
      entry: path.join(__dirname, "bootstrap-lambda/handler.ts"),
      logGroup: bootstrapFnLogGroup,
      bundling: {
        minify: true,
        sourceMap: false,
        // Node 20 runtime does not include AWS SDK v3; bundle the Secrets Manager client.
        externalModules: [],
      },
    });

    if (!cluster.secret) {
      throw new Error("Expected cluster secret from fromGeneratedSecret credentials");
    }
    cluster.secret.grantRead(onEvent);

    const providerLogGroup = new logs.LogGroup(this, "DbBootstrapProviderLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const provider = new Provider(this, "DbBootstrapProvider", {
      onEventHandler: onEvent,
      logGroup: providerLogGroup,
    });

    const bootstrap = new cdk.CustomResource(this, "DatabaseBootstrap", {
      serviceToken: provider.serviceToken,
      resourceType: "Custom::HypercareDatabaseBootstrap",
      properties: { SecretArn: cluster.secret.secretArn },
    });
    bootstrap.node.addDependency(cluster);

    new cdk.CfnOutput(this, "ClusterEndpoint", {
      value: cluster.clusterEndpoint.hostname,
      description: "Aurora cluster writer endpoint",
    });
    new cdk.CfnOutput(this, "ClusterPort", {
      value: cluster.clusterEndpoint.port.toString(),
    });
    new cdk.CfnOutput(this, "ClusterReaderEndpoint", {
      value: cluster.clusterReadEndpoint.hostname,
      description: "Aurora read endpoint (same as writer when no readers)",
    });
    new cdk.CfnOutput(this, "SecretArn", { value: cluster.secret.secretArn });
    new cdk.CfnOutput(this, "DbNameDev", { value: "hypercare_dev" });
    new cdk.CfnOutput(this, "DbNameProd", { value: "hypercare_prod" });
    new cdk.CfnOutput(this, "VpcId", { value: vpc.vpcId });
    new cdk.CfnOutput(this, "BastionInstanceId", { value: bastion.instanceId });
  }
}
