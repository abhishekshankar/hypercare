"use client";

import { useCrisisStripPulse } from "./crisis-strip-pulse";

/**
 * Persistent crisis-resources strip rendered at the top of every route
 * (mounted in `app/layout.tsx`).
 *
 * `data-pulse` is the public hook (added in TASK-011) that lets a
 * component on the page (e.g. `<TriageCard />`) request a visual
 * emphasis. The strip subscribes to the global pulse counter via
 * `useCrisisStripPulse()`; when the active TriageCard requests emphasis the attribute
 * flips to `"true"`. We intentionally avoid Context here so this client
 * component can stay mounted under the *server* root layout without
 * forcing every descendant into a client tree.
 */
export function CrisisStrip() {
  const pulse = useCrisisStripPulse();
  return (
    <aside
      aria-label="Crisis resources"
      className={
        "sticky top-0 z-50 flex flex-col items-start justify-center gap-2 border-b border-amber-950/10 px-4 py-3 text-left text-[15px] font-medium leading-snug shadow-sm transition-colors md:flex-row md:items-center md:justify-center md:text-center " +
        (pulse
          ? "bg-red-100 text-red-950 ring-2 ring-red-500"
          : "bg-crisis-bg text-crisis-fg")
      }
      data-pulse={pulse ? "true" : undefined}
      data-testid="crisis-strip"
      role="region"
    >
      <p className="mx-auto flex w-full max-w-3xl flex-col gap-2 leading-[1.45] md:flex-row md:flex-wrap md:items-center md:justify-center md:gap-x-[10px]">
        <span className="flex items-center gap-2.5 md:contents">
          <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full bg-crisis-fg shadow-[0_0_0_3px_rgba(255,247,238,0.22)]" />
          <span className="md:sr-only">
            <strong>In crisis right now?</strong>
          </span>
        </span>
        <span className="md:inline">
          <span className="hidden md:inline">In crisis right now? Call the </span>
          <span className="md:hidden">Call the </span>
          Alzheimer&apos;s Association 24/7 helpline:{" "}
          <a
            aria-label="Call the Alzheimer's Association 24/7 helpline"
            className="font-bold text-crisis-fg underline decoration-crisis-fg/40 underline-offset-[3px] outline-none ring-offset-2 ring-offset-crisis-bg focus-visible:ring-2 focus-visible:ring-crisis-link-focus"
            href="tel:8002723900"
          >
            800-272-3900
          </a>
          .
        </span>
      </p>
    </aside>
  );
}
