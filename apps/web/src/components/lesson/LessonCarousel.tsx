"use client";

import type { ReactNode } from "react";

export function LessonCarousel(props: Readonly<{
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  /**
   * When `true`, disables Next (e.g. next card not loaded yet) in addition to the end-of-deck check.
   */
  lockNext?: boolean;
  children: ReactNode;
}>) {
  const { current, total, onPrev, onNext, lockNext, children } = props;
  return (
    <div className="space-y-4">
      <div className="min-h-[50vh] rounded-xl border border-border bg-background p-5 shadow-sm sm:min-h-[60vh]">
        {children}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40"
          disabled={current === 0}
          onClick={onPrev}
          type="button"
        >
          ← Back
        </button>
        <p className="text-xs text-muted-foreground" data-testid="lesson-card-pos">
          {current + 1} / {total}
        </p>
        <button
          className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40"
          disabled={current >= total - 1 || lockNext === true}
          onClick={onNext}
          type="button"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
