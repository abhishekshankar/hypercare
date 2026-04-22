import { createDbClient } from "../client.js";
import { modelRoutingDecisions } from "../schema/model-routing-decisions.js";

export type InsertModelRoutingDecisionInput = {
  messageId: string;
  userId: string;
  cohort: string;
  classifierVerdict: unknown;
  policyVersion: number;
  matchedRule: number | null;
  modelId: string;
  reason: string;
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costEstimateUsd: string | null;
};

export async function insertModelRoutingDecision(
  databaseUrl: string,
  row: InsertModelRoutingDecisionInput,
): Promise<void> {
  const db = createDbClient(databaseUrl);
  await db.insert(modelRoutingDecisions).values({
    messageId: row.messageId,
    userId: row.userId,
    cohort: row.cohort,
    classifierVerdict: row.classifierVerdict,
    policyVersion: row.policyVersion,
    matchedRule: row.matchedRule,
    modelId: row.modelId,
    reason: row.reason,
    latencyMs: row.latencyMs,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    costEstimateUsd: row.costEstimateUsd,
  });
}
