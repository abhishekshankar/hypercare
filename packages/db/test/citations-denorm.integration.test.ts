import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createDbClient } from "../src/client.js";
import { conversations, messages, moduleChunks, modules, users } from "../src/schema/index.js";

const enabled = process.env.CITATIONS_DENORM_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

/**
 * Proves the ADR claim: `messages.citations` is the source of truth for
 * historical chips. Mutating the referenced `module_chunks` row (re-embed)
 * does not change what we read from `messages` after a reload.
 *
 * Skipped by default: set `CITATIONS_DENORM_INTEGRATION=1` and `DATABASE_URL` (see
 * `CONTRIBUTING.md` → Database integration tests). Run:
 * `CITATIONS_DENORM_INTEGRATION=1 DATABASE_URL=... pnpm --filter @alongside/db test test/citations-denorm.integration.test.ts`
 */
describe("citations denormalization (integration, real Postgres)", () => {
  it.skipIf(!enabled)("keeps message citation JSON when module_chunks content changes", async () => {
    const databaseUrl = process.env.DATABASE_URL as string;
    const db = createDbClient(databaseUrl);
    const suffix = `denorm-${Date.now().toString(36)}`;
    const chunkId = "22222222-2222-4222-8222-222222222222";
    const userId = "33333333-3333-4333-8333-333333333333";
    const modSlug = `test-mod-${suffix}`;

    const citationSnapshot = {
      chunkId,
      moduleSlug: modSlug,
      sectionHeading: "Section text frozen on the message row",
      attributionLine: "Test attribution (integration)",
    };

    try {
      await db
        .insert(users)
        .values({
          id: userId,
          cognitoSub: `cognito-${suffix}`,
          email: `denorm-${suffix}@example.test`,
        });

      const [mod] = await db
        .insert(modules)
        .values({
          slug: modSlug,
          title: "Denorm test module",
          category: "behaviors",
          tier: 1,
          summary: "s",
          bodyMd: "b",
          attributionLine: "a",
          published: true,
        })
        .returning({ id: modules.id });
      if (!mod) throw new Error("module insert");

      const zeroVec = sql`(SELECT array_fill(0::float, ARRAY[1024])::vector)`;
      await db.insert(moduleChunks).values({
        id: chunkId,
        moduleId: mod.id,
        chunkIndex: 0,
        content: "Chunk body in DB before re-embed simulation",
        tokenCount: 10,
        embedding: zeroVec,
        metadata: {},
      });

      const [conv] = await db
        .insert(conversations)
        .values({ userId, title: "t" })
        .returning({ id: conversations.id });
      if (!conv) throw new Error("conversation insert");

      await db
        .insert(messages)
        .values({
          conversationId: conv.id,
          role: "user",
          content: "q",
          responseKind: null,
          citations: [],
          refusal: null,
        });

      await db.insert(messages).values({
        conversationId: conv.id,
        role: "assistant",
        content: "Answer with citation [1].",
        responseKind: "answer",
        citations: [citationSnapshot],
        refusal: null,
      });

      const readCitations = async () => {
        const [row] = await db
          .select({ citations: messages.citations })
          .from(messages)
          .where(
            and(eq(messages.conversationId, conv.id), eq(messages.role, "assistant")),
          );
        return row?.citations as Array<typeof citationSnapshot> | undefined;
      };

      const before = await readCitations();
      expect(
        before?.find((c) => c.sectionHeading === citationSnapshot.sectionHeading)?.sectionHeading,
      ).toBe("Section text frozen on the message row");

      await db
        .update(moduleChunks)
        .set({ content: "COMPLETELY NEW TEXT AFTER RE-EMBED" })
        .where(eq(moduleChunks.id, chunkId));

      const after = await readCitations();
      expect(
        after?.find((c) => c.sectionHeading === citationSnapshot.sectionHeading)?.sectionHeading,
      ).toBe("Section text frozen on the message row");
    } finally {
      await db.delete(users).where(eq(users.id, userId));
      await db.delete(modules).where(eq(modules.slug, modSlug));
    }
  });
});
