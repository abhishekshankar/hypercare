import "server-only";

import { insertModelRoutingDecision } from "@alongside/db";
import type { AnswerResult, RoutingAuditPayload } from "@alongside/rag";

import { modelRoutingEnabled, serverEnv } from "@/lib/env.server";
import { estimateBedrockCostUsd } from "@/lib/internal/metrics/bedrock-pricing";

export async function persistModelRoutingDecisionIfEnabled(args: {
  assistantMessageId: string;
  result: AnswerResult;
}): Promise<void> {
  if (!modelRoutingEnabled()) return;
  const audit: RoutingAuditPayload | undefined =
    "routingAudit" in args.result && args.result.routingAudit !== undefined
      ? args.result.routingAudit
      : undefined;
  if (audit === undefined) return;

  const costEstimateUsd =
    audit.tokensIn != null && audit.tokensOut != null
      ? estimateBedrockCostUsd(audit.tokensIn, audit.tokensOut).toFixed(6)
      : null;

  await insertModelRoutingDecision(serverEnv.DATABASE_URL, {
    messageId: args.assistantMessageId,
    userId: audit.userId,
    cohort: audit.cohort,
    classifierVerdict: audit.classifierVerdict,
    policyVersion: audit.policyVersion,
    matchedRule: audit.matchedRuleIndex,
    modelId: audit.modelId,
    reason: audit.reason,
    latencyMs: audit.latencyMs,
    tokensIn: audit.tokensIn,
    tokensOut: audit.tokensOut,
    costEstimateUsd,
  });
}
