"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

import type { ModuleEvidenceRow } from "@/lib/library/load-evidence";

function preprocessCitations(md: string): string {
  return md.replace(/\[(\d+)\](?!\()/g, "[$1](#cite-$1)");
}

export function ModuleMarkdownWithCitations({
  markdown,
  evidenceByAnchor,
}: Readonly<{
  markdown: string;
  evidenceByAnchor: Record<string, ModuleEvidenceRow>;
}>) {
  const [open, setOpen] = useState<number | null>(null);
  const src = preprocessCitations(markdown);

  return (
    <article
      className="space-y-4 text-base leading-relaxed text-foreground [&_h2]:mt-8 [&_h2]:scroll-mt-4 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:text-foreground [&_h2]:first:mt-0 [&_p]:text-foreground [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-medium"
      data-testid="module-article-body"
    >
      <ReactMarkdown
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith("#cite-")) {
              const n = Number.parseInt(href.replace("#cite-", ""), 10);
              const anchor = `[${n}]`;
              const ev = evidenceByAnchor[anchor];
              const expanded = open === n;
              const panelId = `cite-panel-${String(n)}`;
              return (
                <span className="inline">
                  <button
                    aria-controls={panelId}
                    aria-expanded={expanded}
                    aria-label={`Source ${n}${expanded ? " (showing details)" : ""}`}
                    className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-accent/40 bg-accent/10 px-1.5 align-super text-[0.65rem] font-medium leading-none text-accent outline-none ring-offset-background transition hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent"
                    onClick={(e) => {
                      e.preventDefault();
                      setOpen(expanded ? null : n);
                    }}
                    type="button"
                  >
                    [{n}]
                  </button>
                  {expanded && ev ? (
                    <span className="relative inline-block align-baseline">
                      <span
                        className="absolute left-0 top-full z-10 mt-1 w-[min(100vw-2rem,22rem)] rounded-md border border-border bg-background px-3 py-2 text-left text-sm text-muted-foreground shadow-md"
                        id={panelId}
                        role="region"
                      >
                        {ev.quotedExcerpt ? <p className="text-foreground">{ev.quotedExcerpt}</p> : null}
                        {ev.urlSnapshot && ev.url ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Captured snapshot — the live journal site may block direct loads.
                          </p>
                        ) : null}
                        {ev.url ? (
                          <a
                            className="mt-2 inline-block text-accent underline-offset-2 hover:underline"
                            href={ev.url}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            Open source
                          </a>
                        ) : ev.urlSnapshot ? (
                          <p className="mt-2 text-xs">Source text is available from our captured snapshot only.</p>
                        ) : null}
                      </span>
                    </span>
                  ) : null}
                </span>
              );
            }
            return (
              <a className="text-accent underline underline-offset-2" href={href ?? "#"} rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {src}
      </ReactMarkdown>
    </article>
  );
}
