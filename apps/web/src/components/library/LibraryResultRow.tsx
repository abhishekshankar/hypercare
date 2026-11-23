import Link from "next/link";

import { ModuleCard } from "@/components/library/ModuleCard";
import type { LibraryModuleListItem } from "@/lib/library/types";

export type LibraryStreamResult = {
  id: string;
  kind: "saved_answer" | "recent_topic" | "bookmarked_module";
  title: string;
  snippet: string;
  score: number;
  source: string;
  conversationId?: string | null;
  messageId?: string | null;
  module?: LibraryModuleListItem | null;
};

export function LibraryResultRow({ row }: Readonly<{ row: LibraryStreamResult }>) {
  if (row.kind === "bookmarked_module" && row.module != null) {
    return <ModuleCard module={row.module} />;
  }

  if (
    row.kind === "saved_answer" &&
    row.conversationId != null &&
    row.conversationId.length > 0 &&
    row.messageId != null &&
    row.messageId.length > 0
  ) {
    return (
      <Link
        className="block rounded-lg border border-border bg-card p-4 text-left shadow-sm transition hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid="library-saved-result"
        href={`/app/conversation/${row.conversationId}#message-${row.messageId}`}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saved answer</p>
        <h3 className="mt-1 font-medium text-foreground">{row.title}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{row.snippet}</p>
      </Link>
    );
  }

  return (
    <div
      className="rounded-lg border border-border bg-card p-4 text-left shadow-sm"
      data-testid="library-generic-result"
    >
      <h3 className="font-medium text-foreground">{row.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{row.snippet}</p>
    </div>
  );
}
