import { eq, lt, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createDbClient } from "../src/client.js";
import {
  conversations,
  messages,
  modelRoutingDecisions,
  users,
} from "../src/schema/index.js";

const enabled = process.env.ROUTING_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

describe("model_routing_decisions (integration)", () => {
  it.skipIf(!enabled)("inserts a row and prunes rows older than 90 days", async () => {
    const databaseUrl = process.env.DATABASE_URL as string;
    const db = createDbClient(databaseUrl);
    const suffix = `rt-${Date.now().toString(36)}`;
    const userId = "44444444-4444-4444-8444-444444444444";
    const convId = "55555555-5555-4555-8555-555555555555";
    const msgId = "66666666-6666-4666-8666-666666666666";

    try {
      await db.insert(users).values({
        id: userId,
        cognitoSub: `cognito-${suffix}`,
        email: `${suffix}@example.test`,
        routingCohort: "routing_v1_treatment",
      });

      await db.insert(conversations).values({
        id: convId,
        userId,
        title: "t",
      });

      await db.insert(messages).values({
        id: msgId,
        conversationId: convId,
        role: "assistant",
        content: "x",
        responseKind: "answer",
      });

      await db.insert(modelRoutingDecisions).values({
        messageId: msgId,
        userId,
        cohort: "routing_v1_treatment",
        classifierVerdict: { topic: "medical", urgency: "normal", stage: null, is_refusal_template: false },
        policyVersion: 1,
        matchedRule: 0,
        modelId: "test-model",
        reason: "integration",
        latencyMs: 12,
        tokensIn: 3,
        tokensOut: 4,
        costEstimateUsd: "0.000050",
      });

      const [row] = await db
        .select({ id: modelRoutingDecisions.id })
        .from(modelRoutingDecisions)
        .where(eq(modelRoutingDecisions.messageId, msgId))
        .limit(1);
      expect(row?.id).toBeDefined();

      await db
        .update(modelRoutingDecisions)
        .set({ createdAt: sql`now() - interval '91 days'` })
        .where(eq(modelRoutingDecisions.messageId, msgId));

      await db.delete(modelRoutingDecisions).where(lt(modelRoutingDecisions.createdAt, sql`now() - interval '90 days'`));

      const [gone] = await db
        .select({ id: modelRoutingDecisions.id })
        .from(modelRoutingDecisions)
        .where(eq(modelRoutingDecisions.messageId, msgId))
        .limit(1);
      expect(gone?.id).toBeUndefined();
    } finally {
      await db.delete(modelRoutingDecisions).where(eq(modelRoutingDecisions.userId, userId));
      await db.delete(messages).where(eq(messages.conversationId, convId));
      await db.delete(conversations).where(eq(conversations.id, convId));
      await db.delete(users).where(eq(users.id, userId));
    }
  });
});
