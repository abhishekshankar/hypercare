"use client";

export function CitationChip({
  displayNumber,
  expanded,
  onToggle,
  controlsId,
}: Readonly<{
  displayNumber: number;
  expanded: boolean;
  onToggle: () => void;
  controlsId: string;
}>) {
  return (
    <button
      aria-controls={controlsId}
      aria-expanded={expanded}
      aria-label={`Source ${displayNumber}${expanded ? " (showing details)" : ""}`}
      className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-accent/40 bg-accent/10 px-1.5 align-super text-[0.65rem] font-medium leading-none text-accent outline-none ring-offset-background transition hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent"
      onClick={onToggle}
      type="button"
    >
      [{displayNumber}]
    </button>
  );
}
