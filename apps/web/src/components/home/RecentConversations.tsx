import Link from "next/link";

import type { RecentConversation } from "@/lib/conversation/load";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}

export function RecentConversations({
  items,
}: Readonly<{ items: RecentConversation[] }>) {
  if (items.length === 0) {
    return (
      <section
        aria-label="Recent conversations"
        className="text-sm text-muted-foreground"
        data-testid="recent-conversations"
      >
        <p>No conversations yet.</p>
      </section>
    );
  }
  return (
    <section
      aria-label="Recent conversations"
      className="space-y-2"
      data-testid="recent-conversations"
    >
      <p className="along-section-label mb-3">Recent conversations</p>
      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {items.map((c) => (
          <li key={c.id}>
            <Link
              className="flex items-center justify-between gap-4 px-4 py-3 outline-none ring-offset-background hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-accent"
              href={`/app/conversation/${c.id}`}
            >
              <span className="truncate text-sm text-foreground">
                {c.title?.trim() || (c.preview ? truncate(c.preview, 80) : "(empty conversation)")}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {relativeTime(c.updatedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
