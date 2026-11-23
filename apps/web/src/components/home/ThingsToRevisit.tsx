import Link from "next/link";

import type { HomeSaveTeaser } from "@/lib/saved/service";

type Props = {
  items: HomeSaveTeaser[];
};

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}

export function ThingsToRevisit({ items }: Readonly<Props>) {
  if (items.length === 0) {
    return (
      <section
        aria-label="Things to revisit"
        className="text-sm text-muted-foreground"
        data-testid="things-to-revisit"
      >
        <p className="along-section-label mb-3">Things to revisit</p>
        <p>Nothing saved yet. Tap the bookmark on any answer that helps.</p>
      </section>
    );
  }
  return (
    <section
      aria-label="Things to revisit"
      className="space-y-2"
      data-testid="things-to-revisit"
    >
      <p className="along-section-label mb-3">Things to revisit</p>
      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              className="flex flex-col gap-0.5 px-4 py-3 outline-none ring-offset-background hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-accent"
              href={`/app/conversation/${it.conversation_id}#message-${it.message_id}`}
            >
              <span className="text-sm font-medium text-foreground">
                {truncate(it.question_text, 120)}
              </span>
              <span className="line-clamp-2 text-sm text-muted-foreground">{it.teaser}</span>
              <span className="text-xs text-muted-foreground">
                Saved {it.relative_label} · {truncate(it.conversation_line, 80)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="pt-1 text-right text-sm">
        <Link
          className="text-accent underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent"
          href="/app/saves"
        >
          See all →
        </Link>
      </p>
    </section>
  );
}
