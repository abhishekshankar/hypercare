import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { createDbClient, messages } from "@alongside/db";

import { serverEnv } from "@/lib/env.server";

/** Most recent user message in the thread (the line *before* the current send). */
export async function getPriorUserMessageContent(conversationId: string): Promise<string | null> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db
    .select({ content: messages.content })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.role, "user")))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return row?.content ?? null;
}
