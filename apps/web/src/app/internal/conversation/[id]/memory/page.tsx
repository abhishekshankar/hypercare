import { eq } from "drizzle-orm";
import { conversationMemory, createDbClient } from "@hypercare/db";
import ReactMarkdown from "react-markdown";

import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

export default async function ConversationMemoryPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id: conversationId } = await params;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db
    .select()
    .from(conversationMemory)
    .where(eq(conversationMemory.conversationId, conversationId))
    .limit(1);
  if (row == null) {
    return (
      <div>
        <h1 className="text-sm font-medium">No memory row</h1>
        <p className="text-xs text-zinc-500">Conversation {conversationId}</p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-sm font-medium">Conversation memory (audit)</h1>
      <p className="text-xs text-zinc-500">tokens {row.summaryTokens} · refreshed {row.lastRefreshedAt.toISOString()}</p>
      <div className="prose prose-sm mt-2 max-w-none text-zinc-800">
        <ReactMarkdown>{row.summaryMd}</ReactMarkdown>
      </div>
    </div>
  );
}
