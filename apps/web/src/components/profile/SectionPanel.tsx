"use client";

import { useState, type ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  children: (ctx: { setEditing: (v: boolean) => void }) => ReactNode;
};

export function SectionPanel({ id, title, summary, detail, children }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <section
      className="rounded-lg border border-border bg-card text-card-foreground shadow-sm"
      data-testid={`profile-section-${id}`}
    >
      <button
        aria-expanded={open}
        className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left md:flex-row md:items-center md:justify-between"
        onClick={() => {
          setOpen((v) => {
            if (v) {
              setEditing(false);
            }
            return !v;
          });
        }}
        type="button"
      >
        <span className="font-medium text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{summary}</span>
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-4">
          {editing ? (
            children({ setEditing })
          ) : (
            <div className="space-y-4">
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{detail}</p>
              <button
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium"
                onClick={() => setEditing(true)}
                type="button"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
