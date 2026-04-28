"use client";

import { useState } from "react";
import type { Checklist } from "@alongside/content/tools";

export function ChecklistTool({ data }: Readonly<{ data: Checklist }>) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  return (
    <section className="rounded-lg border border-border bg-muted/15 px-4 py-4" data-testid={`tool-checklist-${data.slug}`}>
      <h2 className="font-serif text-lg font-medium text-foreground">{data.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{data.context}</p>
      <ul className="mt-4 space-y-3">
        {data.items.map((it: Checklist["items"][number]) => (
          <li key={it.id} className="rounded-md border border-border/60 bg-background/80 p-3">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                checked={!!done[it.id]}
                className="mt-1"
                onChange={() => setDone((d) => ({ ...d, [it.id]: !d[it.id] }))}
                type="checkbox"
              />
              <span className="text-sm font-medium text-foreground">{it.label}</span>
            </label>
            <button
              className="mt-2 text-xs text-accent underline-offset-2 hover:underline"
              onClick={() => setOpen((o) => ({ ...o, [it.id]: !o[it.id] }))}
              type="button"
            >
              {open[it.id] ? "Hide" : "Why"} details
            </button>
            {open[it.id] ? (
              <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                <p>{it.rationale}</p>
                <p className="text-foreground/80">{it.what_to_look_for}</p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
