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
        "sticky top-0 z-50 border-b border-border px-4 py-2.5 text-center text-sm shadow-sm transition-colors " +
        (pulse
          ? "bg-red-100 text-red-950 ring-2 ring-red-500"
          : "bg-crisis-bg text-crisis-fg")
      }
      data-pulse={pulse ? "true" : undefined}
      data-testid="crisis-strip"
      role="region"
    >
      <p className="mx-auto max-w-3xl leading-snug">
        In crisis right now? Call the Alzheimer&apos;s Association 24/7 helpline:{" "}
        <a
          aria-label="Call the Alzheimer's Association 24/7 helpline"
          className="font-semibold underline decoration-crisis-fg/40 underline-offset-2 outline-none ring-offset-2 ring-offset-crisis-bg focus-visible:ring-2 focus-visible:ring-accent"
          href="tel:8002723900"
        >
          800-272-3900
        </a>
        .
      </p>
    </aside>
  );
}
