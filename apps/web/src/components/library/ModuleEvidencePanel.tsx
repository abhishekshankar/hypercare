import type { ModuleEvidenceRow } from "@/lib/library/load-evidence";

export function ModuleEvidencePanel({ rows }: Readonly<{ rows: ModuleEvidenceRow[] }>) {
  if (rows.length === 0) return null;
  return (
    <details className="rounded-lg border border-border bg-muted/20 px-4 py-3" data-testid="module-evidence-panel">
      <summary className="cursor-pointer text-sm font-medium text-foreground">Sources and evidence</summary>
      <ol className="mt-4 space-y-4 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="border-b border-border/60 pb-3 last:border-0" id={r.claimAnchor ?? r.id}>
            <p className="font-medium text-foreground">
              {r.claimAnchor ?? "—"} — Tier {r.sourceTier} ({r.sourceType})
            </p>
            <p className="mt-1 text-muted-foreground">{r.citation}</p>
            {r.quotedExcerpt ? <p className="mt-2 italic text-foreground/90">&ldquo;{r.quotedExcerpt}&rdquo;</p> : null}
            {r.url ? (
              <a
                className="mt-2 inline-block text-accent underline-offset-2 hover:underline"
                href={r.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                View original source
              </a>
            ) : null}
            {r.urlSnapshot && !r.url ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Captured snapshot on file — the publisher site may not load directly.
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
