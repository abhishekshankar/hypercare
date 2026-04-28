"use client";

import { useState } from "react";
import type { Template } from "@alongside/content/tools";

export function TemplateTool({ data }: Readonly<{ data: Template }>) {
  const [vals, setVals] = useState<Record<string, string>>({});
  return (
    <section className="rounded-lg border border-border bg-muted/15 px-4 py-4" data-testid={`tool-template-${data.slug}`}>
      <h2 className="font-serif text-lg font-medium text-foreground">{data.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{data.instructions}</p>
      <div className="mt-4 space-y-3">
        {data.fields.map((f) => (
          <label key={f.id} className="block text-sm">
            <span className="font-medium text-foreground">{f.label}</span>
            {f.kind === "textarea" ? (
              <textarea
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2"
                onChange={(e) => setVals((v) => ({ ...v, [f.id]: e.target.value }))}
                rows={4}
                value={vals[f.id] ?? ""}
              />
            ) : (
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2"
                onChange={(e) => setVals((v) => ({ ...v, [f.id]: e.target.value }))}
                type="text"
                value={vals[f.id] ?? ""}
              />
            )}
          </label>
        ))}
      </div>
      <button
        className="mt-4 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted/60"
        onClick={() => window.print()}
        type="button"
      >
        Print this form
      </button>
    </section>
  );
}
