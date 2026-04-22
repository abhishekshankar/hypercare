"use client";

/**
 * Tiny pub-sub for the crisis strip's `data-pulse` attribute.
 *
 * Keeping this as a bare module-level event rather than a React Context
 * avoids forcing the persistent `<CrisisStrip />` (which lives in the root
 * layout — a *server* component) to be wrapped in a provider that would
 * push everything beneath it into a client tree.
 *
 * Contract:
 *   - `setCrisisStripPulse(true)`  → adds `data-pulse="true"` to the strip.
 *   - `setCrisisStripPulse(false)` → removes the attribute.
 *   - The strip mounts its own listener via `useCrisisStripPulse()`.
 *
 * `TriageCard` only registers a pulse when it is the **current** triage
 * (latest assistant turn). We still ref-count so multiple simultaneous
 * registrations (e.g. edge cases) coalesce, and unmount or deactivation
 * runs the matching cleanup.
 */

import { useEffect, useState } from "react";

const EVENT = "hypercare:crisis-pulse";

type GlobalWithCount = typeof globalThis & {
  __HYPERCARE_PULSE_COUNT__?: number;
};

function emit(active: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<boolean>(EVENT, { detail: active }));
}

export function setCrisisStripPulse(on: boolean): void {
  if (typeof window === "undefined") return;
  const g = globalThis as GlobalWithCount;
  const prev = g.__HYPERCARE_PULSE_COUNT__ ?? 0;
  const next = Math.max(0, prev + (on ? 1 : -1));
  g.__HYPERCARE_PULSE_COUNT__ = next;
  emit(next > 0);
}

export function useCrisisStripPulse(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    function onEvent(e: Event) {
      const ce = e as CustomEvent<boolean>;
      setActive(Boolean(ce.detail));
    }
    window.addEventListener(EVENT, onEvent);
    const g = globalThis as GlobalWithCount;
    setActive((g.__HYPERCARE_PULSE_COUNT__ ?? 0) > 0);
    return () => window.removeEventListener(EVENT, onEvent);
  }, []);
  return active;
}
