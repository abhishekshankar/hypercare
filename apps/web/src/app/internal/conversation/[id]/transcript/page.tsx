import { eq, asc } from "drizzle-orm";
import { conversations, createDbClient, messages } from "@hypercare/db";
import { notFound } from "next/navigation";

import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

export default async function ConversationTranscriptPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id: conversationId } = await params;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [c] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (c == null) {
    notFound();
  }
  const list = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      responseKind: messages.responseKind,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  return (
    <div>
      <h1 className="text-sm font-medium">Conversation transcript (admin)</h1>
      <p className="text-xs text-zinc-500">ID {conversationId}</p>
      <ul className="mt-3 space-y-3 text-sm">
        {list.map((m) => (
          <li
            key={m.id}
            className={`rounded border p-2 ${m.role === "user" ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-50"}`}
          >
            <div className="text-xs text-zinc-500">
              {m.role} · {m.createdAt.toISOString()}
              {m.responseKind != null && m.responseKind.length > 0 ? ` · ${m.responseKind}` : ""}
            </div>
            <div className="mt-1 whitespace-pre-wrap break-words text-zinc-900">
              {m.content.slice(0, 8000)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
