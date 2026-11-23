"use client";

import { useState } from "react";
import Link from "next/link";

import type { BranchAxes } from "@/lib/library/branch-labels";
import { branchKeyFromAxes, humanizeBranchAxes, tailoredPillLine } from "@/lib/library/branch-labels";

export function ModuleHeavyBranchBar({
  slug,
  picked,
  alternatives,
}: Readonly<{
  slug: string;
  picked: BranchAxes;
  alternatives: BranchAxes[];
}>) {
  const [modal, setModal] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);
  const others = alternatives.filter(
    (b) =>
      b.stageKey !== picked.stageKey ||
      b.relationshipKey !== picked.relationshipKey ||
      b.livingSituationKey !== picked.livingSituationKey,
  );

  return (
    <div className="space-y-3" data-testid="module-branch-bar">
      <div className="flex flex-wrap items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-foreground">
        <span>{tailoredPillLine(picked)}</span>
        <button
          className="text-accent underline-offset-2 hover:underline"
          onClick={() => setModal(true)}
          type="button"
        >
          Why this version?
        </button>
      </div>
      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
          <div className="max-w-md rounded-lg border border-border bg-background p-4 text-sm shadow-lg" role="dialog">
            <p className="text-foreground">
              This module changes based on the relationship and stage you set in your care profile. Other versions
              exist for different situations.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="text-accent underline-offset-2 hover:underline" href="/app/profile">
                Edit care profile
              </Link>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setModal(false)} type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {others.length > 0 ? (
        <div>
          <button
            aria-expanded={openPicker}
            className="text-sm text-accent underline-offset-2 hover:underline"
            onClick={() => setOpenPicker(!openPicker)}
            type="button"
          >
            Read other versions
          </button>
          {openPicker ? (
            <ul className="mt-2 space-y-1 rounded-md border border-border bg-muted/20 p-2 text-sm">
              {others.map((b) => {
                const key = branchKeyFromAxes(b);
                return (
                  <li key={key}>
                    <Link className="text-accent hover:underline" href={`/app/modules/${slug}?branch=${encodeURIComponent(key)}`}>
                      {humanizeBranchAxes(b)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
