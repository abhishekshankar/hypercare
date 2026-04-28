import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { ConversationThread } from "@/components/conversation/ConversationThread";
import { loadThread } from "@/lib/conversation/load";
import { loadSavesInConversation } from "@/lib/saved/service";
import { maybeDecodePercentEncoding } from "@/lib/url/maybe-decode-uri-component";

export default async function ConversationPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const session = await requireSession();
  const { id } = await params;
  const { q } = await searchParams;

  const [thread, initialSaves] = await Promise.all([
    loadThread(id, session.userId),
    loadSavesInConversation(session.userId, id),
  ]);
  if (!thread) {
    notFound();
  }

  // `q` carries the prefill text from `/app` when the user clicked a
  // starter chip or used the home composer. It auto-submits exactly once
  // (see `Composer`) so a back/forward navigation doesn't double-send.
  // Some stacks still surface `q` percent-encoded — normalize before send.
  const autoSubmit =
    typeof q === "string" && thread.messages.length === 0 ? maybeDecodePercentEncoding(q) : undefined;

  return (
    <div className="space-y-6">
      <ConversationThread
        autoSubmit={autoSubmit}
        conversationId={thread.id}
        initialMessages={thread.messages}
        initialSaves={initialSaves}
      />
    </div>
  );
}
