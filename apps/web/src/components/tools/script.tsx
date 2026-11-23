"use client";

import { useState } from "react";
import type { Script } from "@alongside/content/tools";

export function ScriptTool({ data }: Readonly<{ data: Script }>) {
  const [open, setOpen] = useState(0);
  return (
    <section className="rounded-lg border border-border bg-muted/15 px-4 py-4" data-testid={`tool-script-${data.slug}`}>
      <h2 className="font-serif text-lg font-medium text-foreground">{data.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{data.context}</p>
      <div className="mt-4 space-y-2">
        {data.openings.map((line, i) => (
          <div key={i} className="rounded-md border border-border/60">
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
              onClick={() => setOpen(open === i ? -1 : i)}
              type="button"
            >
              <span>Opening {i + 1}</span>
              <span>{open === i ? "−" : "+"}</span>
            </button>
            {open === i ? (
              <div className="space-y-3 border-t border-border/60 px-3 py-3 text-sm">
                <p className="text-foreground">{line}</p>
                <ul className="space-y-2">
                  {data.if_they.map((row, j) => (
                    <li key={j}>
                      <p className="font-medium text-foreground">If they: {row.response}</p>
                      <p className="text-muted-foreground">{row.what_to_say}</p>
                    </li>
                  ))}
                </ul>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Things not to say</p>
                  <ul className="mt-1 list-disc pl-5">
                    {data.things_not_to_say.map((t, k) => (
                      <li key={k}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
