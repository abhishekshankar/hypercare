"use client";

import type { StageKey } from "@/lib/library/types";

const STAGE_LABEL: Record<StageKey, string> = {
  early: "Early",
  middle: "Middle",
  late: "Late",
};

type StageFilterProps = Readonly<{
  selected: ReadonlySet<StageKey>;
  onToggle: (stage: StageKey) => void;
  onAny: () => void;
}>;

export function StageFilter({ selected, onToggle, onAny }: StageFilterProps) {
  const any = selected.size === 0;
  return (
    <div className="flex flex-wrap gap-2" data-testid="library-stage-filter" role="group" aria-label="Filter by stage">
      <button
        type="button"
        className={
          any
            ? "rounded-full border border-accent bg-accent/15 px-3 py-1.5 text-sm text-foreground"
            : "rounded-full border border-border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50"
        }
        onClick={onAny}
        data-testid="library-stage-any"
      >
        Any
      </button>
      {(["early", "middle", "late"] as const).map((s) => {
        const on = selected.has(s);
        return (
          <button
            type="button"
            key={s}
            className={
              on
                ? "rounded-full border border-accent bg-accent/15 px-3 py-1.5 text-sm text-foreground"
                : "rounded-full border border-border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50"
            }
            onClick={() => onToggle(s)}
            data-testid={`library-stage-${s}`}
          >
            {STAGE_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}
