"use client";

import Link from "next/link";
import type { Citation } from "@hypercare/rag";

/**
 * Section heading is the chunk's heading from the seeded module markdown.
 * We don't have the parent module *title* on the Citation type — TASK-011
 * §"Citation UX" lists "module title" as a render slot but the rag layer
 * intentionally only exposes `moduleSlug` (so the UI can re-fetch full
 * module metadata in a later task without us caching the title at
 * citation-write time and going stale). For v0 we surface the slug as a
 * humanised label and link out to the stub `/app/modules/[slug]` page.
 */

function humaniseSlug(slug: string): string {
  return slug
    .split(/[-/]/)
    .filter((s) => s.length > 0)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" — ");
}

export function CitationExpansion({
  id,
  citation,
}: Readonly<{
  id: string;
  citation: Citation;
}>) {
  const moduleLabel = humaniseSlug(citation.moduleSlug);
  return (
    <div
      className="mt-2 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
      data-testid="citation-expansion"
      id={id}
      role="region"
    >
      <p className="font-serif text-base text-foreground">{moduleLabel}</p>
      <p className="mt-1 text-foreground/80">{citation.sectionHeading}</p>
      <p className="mt-2 italic">{citation.attributionLine}</p>
      <Link
        className="mt-3 inline-block text-accent underline-offset-2 outline-none ring-offset-background hover:underline focus-visible:ring-2 focus-visible:ring-accent"
        href={`/app/modules/${citation.moduleSlug}`}
      >
        Read the full module →
      </Link>
    </div>
  );
}
