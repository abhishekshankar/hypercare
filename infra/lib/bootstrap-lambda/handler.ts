/**
 * CDK Provider onEvent handler: create app databases and enable pgvector.
 * Rejected alternative: RDS Data API — it does not support pgvector operators.
 *
 * TLS: `rds-global-bundle.pem` is the RDS/Aurora global CA bundle from
 * https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem (refresh periodically).
 */
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import type { CloudFormationCustomResourceEvent } from "aws-lambda";
import { Client } from "pg";
import rdsGlobalCaPem from "./rds-global-bundle.pem";

const DB_NAMES = ["hypercare_dev", "hypercare_prod"] as const;

interface RdsSecret {
  username?: string;
  password?: string;
  host?: string;
  port?: string | number;
}

async function loadSecret(secretArn: string): Promise<RdsSecret> {
  const sm = new SecretsManagerClient({});
  const out = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!out.SecretString) {
    throw new Error("Secret has no SecretString");
  }
  return JSON.parse(out.SecretString) as RdsSecret;
}

function createClient(secret: RdsSecret, database: string): Client {
  const host = secret.host;
  const port = secret.port != null ? Number(secret.port) : 5432;
  const user = secret.username;
  const password = secret.password;
  if (!host || !user || !password) {
    throw new Error("Secret missing host, username, or password");
  }
  return new Client({
    host,
    port,
    user,
    password,
    database,
    connectionTimeoutMillis: 120_000,
    ssl: {
      ca: rdsGlobalCaPem,
      rejectUnauthorized: true,
    },
  });
}

type OnEventResult = { PhysicalResourceId: string; Data?: Record<string, string> };

export async function handler(event: CloudFormationCustomResourceEvent): Promise<OnEventResult> {
  const physicalId =
    event.RequestType === "Create" ? "hypercare-db-bootstrap-v1" : event.PhysicalResourceId;

  if (event.RequestType === "Delete") {
    console.log(JSON.stringify({ step: "delete", message: "Skipping DB teardown on stack delete" }));
    return { PhysicalResourceId: physicalId };
  }

  const secretArn = (event.ResourceProperties as { SecretArn?: string }).SecretArn;
  if (!secretArn) {
    throw new Error("ResourceProperties.SecretArn is required");
  }

  console.log(JSON.stringify({ step: "fetch-secret", secretArn }));

  const secret = await loadSecret(secretArn);
  const admin = createClient(secret, "postgres");
  await admin.connect();
  console.log(JSON.stringify({ step: "connected", database: "postgres" }));

  try {
    for (const db of DB_NAMES) {
      const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [db]);
      if ((exists.rowCount ?? 0) === 0) {
        await admin.query(`CREATE DATABASE "${db}"`);
        console.log(JSON.stringify({ step: "create-database", db, created: true }));
      } else {
        console.log(JSON.stringify({ step: "create-database", db, created: false }));
      }
    }
  } finally {
    await admin.end();
  }

  for (const db of DB_NAMES) {
    const dbClient = createClient(secret, db);
    await dbClient.connect();
    try {
      await dbClient.query("CREATE EXTENSION IF NOT EXISTS vector");
      console.log(JSON.stringify({ step: "create-extension", db, extension: "vector" }));
    } finally {
      await dbClient.end();
    }
  }

  return {
    PhysicalResourceId: physicalId,
    Data: { DatabasesBootstrapped: DB_NAMES.join(",") },
  };
}
