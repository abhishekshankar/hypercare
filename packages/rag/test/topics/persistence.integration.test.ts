import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createDbClient } from "@alongside/db";
import { conversations, messages, users } from "@alongside/db";
import { runPipeline, type Deps } from "../../src/pipeline.js";
import { classifyTopics } from "../../src/topics/classifier.js";

const enabled = process.env.TOPICS_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

/**
 * Gated: `TOPICS_INTEGRATION=1 DATABASE_URL=... pnpm --filter @alongside/rag test test/topics/persistence.integration.test.ts`
 */
describe("topic classification + messages row (integration)", () => {
  it.skipIf(!enabled)("result fields round-trip to jsonb on update (mirrors web persist)", async () => {
    const databaseUrl = process.env.DATABASE_URL as string;
    const db = createDbClient(databaseUrl);
    const suffix = `topics-int-${Date.now().toString(36)}`;
    const userId = "44444444-4444-4444-8444-444444444444";
    const invoke = async () => JSON.stringify({ topics: ["bathing-resistance"], confidence: 0.88 });
    const deps: Deps = {
      topicClassify: (input) => classifyTopics(input, { invoke }),
      embed: async () => new Array(1024).fill(0) as unknown as number[],
      search: async () => [
        {
          chunkId: "a",
          moduleId: "m",
          moduleSlug: "mod",
          moduleTitle: "t",
          moduleTier: 1,
          category: "behaviors",
          attributionLine: "a",
          sectionHeading: "h",
          stageRelevance: [] as const,
          chunkIndex: 0,
          content: "c",
          distance: 0.1,
        },
        {
          chunkId: "b",
          moduleId: "m",
          moduleSlug: "mod",
          moduleTitle: "t",
          moduleTier: 1,
          category: "behaviors",
          attributionLine: "a",
          sectionHeading: "h2",
          stageRelevance: [] as const,
          chunkIndex: 1,
          content: "c2",
          distance: 0.2,
        },
        {
          chunkId: "c",
          moduleId: "m",
          moduleSlug: "mod",
          moduleTitle: "t",
          moduleTier: 1,
          category: "behaviors",
          attributionLine: "a",
          sectionHeading: "h3",
          stageRelevance: [] as const,
          chunkIndex: 2,
          content: "c3",
          distance: 0.25,
        },
      ],
      loadCareAxes: async () => ({
        stage: "middle" as const,
        relationship: "parent",
        livingSituation: "with_caregiver",
      }),
      generate: async () => ({
        text: "You can try a calm approach [1].",
        modelId: "int-test",
        inputTokens: 1,
        outputTokens: 1,
        stopReason: "end_turn" as const,
      }),
      safety: { persist: async () => ({ repeatInWindow: false }), disableLlm: true },
    };

    try {
      await db.insert(users).values({
        id: userId,
        cognitoSub: `cog-${suffix}`,
        email: `${suffix}@test.example`,
      });
      const [conv] = await db
        .insert(conversations)
        .values({ userId, title: "t" })
        .returning({ id: conversations.id });
      if (!conv) throw new Error("no conv");
      const [uMsg] = await db
        .insert(messages)
        .values({ conversationId: conv.id, role: "user", content: "shower help" })
        .returning({ id: messages.id });
      if (!uMsg) throw new Error("no user msg");

      const result = await runPipeline({ question: "shower help", userId }, deps);
      expect(result.kind).toBe("answered");
      if (result.kind !== "answered") return;
      expect(result.classifiedTopics).toEqual(["bathing-resistance"]);
      expect(result.topicConfidence).toBe(0.88);

      await db
        .update(messages)
        .set({
          classifiedTopics: result.classifiedTopics,
          topicConfidence: result.topicConfidence,
        })
        .where(and(eq(messages.id, uMsg.id), eq(messages.role, "user")));

      const [row] = await db
        .select({ classifiedTopics: messages.classifiedTopics, topicConfidence: messages.topicConfidence })
        .from(messages)
        .where(eq(messages.id, uMsg.id));
      expect(row?.classifiedTopics).toEqual(["bathing-resistance"]);
      expect(row?.topicConfidence).toBeCloseTo(0.88, 5);
    } finally {
      await db
        .delete(users)
        .where(eq(users.id, userId))
        .catch(() => {});
    }
  });
});
