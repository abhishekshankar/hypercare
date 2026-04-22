import Link from "next/link";

import type { LibraryModuleListItem } from "@/lib/library/types";

function labelStage(s: string): string {
  if (s === "early" || s === "middle" || s === "late") {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s;
}

type ModuleCardProps = Readonly<{
  module: LibraryModuleListItem;
}>;

export function ModuleCard({ module: m }: ModuleCardProps) {
  return (
    <Link
      className="block rounded-lg border border-border bg-card p-4 text-left shadow-sm transition hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      data-testid="library-module-card"
      data-slug={m.slug}
      href={`/app/modules/${m.slug}`}
    >
      <h3 className="font-medium text-foreground">{m.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{m.summary}</p>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Stage relevance">
        {m.stageRelevance.map((s) => (
          <li
            key={s}
            className="rounded bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground"
          >
            {labelStage(s)}
          </li>
        ))}
      </ul>
    </Link>
  );
}
