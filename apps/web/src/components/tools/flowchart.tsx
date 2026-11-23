"use client";

import type { Flowchart } from "@alongside/content/tools";

export function FlowchartTool({ data }: Readonly<{ data: Flowchart }>) {
  return (
    <section className="rounded-lg border border-border bg-muted/15 px-4 py-4" data-testid={`tool-flowchart-${data.slug}`}>
      <h2 className="font-serif text-lg font-medium text-foreground">{data.title}</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-6 text-sm">
        {data.nodes.map((n, i) => (
          <li key={String(n.id)}>
            <p className="text-foreground">{n.step}</p>
            {n.next && n.next.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Then: {n.next.map(String).join(" → ")}</p>
            ) : i < data.nodes.length - 1 ? (
              <p className="mt-1 text-xs text-muted-foreground">Then: continue to step {i + 2}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
