"use client";

export function LessonCloseCard(props: Readonly<{
  onComplete: (revisit: boolean) => void;
  pending: boolean;
}>) {
  const { onComplete, pending } = props;
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-xl border border-border bg-muted/10 px-4 py-8 text-center"
      data-testid="lesson-close-card"
    >
      <p className="text-base text-foreground">You made it to the end.</p>
      <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          className="rounded-md border border-accent bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          data-testid="lesson-got-it"
          disabled={pending}
          onClick={() => onComplete(false)}
          type="button"
        >
          Got it
        </button>
        <button
          className="rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          data-testid="lesson-revisit"
          disabled={pending}
          onClick={() => onComplete(true)}
          type="button"
        >
          I want to revisit this
        </button>
      </div>
    </div>
  );
}
