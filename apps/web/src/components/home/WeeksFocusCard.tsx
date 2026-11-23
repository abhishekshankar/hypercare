import Link from "next/link";

import type { PickerResult } from "@alongside/picker";

export function WeeksFocusCard(props: Readonly<{ result: PickerResult; subtitle: string }>) {
  const { result, subtitle } = props;
  if (result.kind !== "pick") {
    return (
      <section
        aria-label="This week's focus"
        className="along-surface-card"
        data-testid="weeks-focus-card"
      >
        <h2 className="font-serif text-xl font-medium text-foreground">This week&apos;s focus</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing new this week — try the{" "}
          <Link className="text-accent underline-offset-2 hover:underline" href="/app/library">
            library
          </Link>
          .
        </p>
      </section>
    );
  }
  return (
    <section
      aria-label="This week's focus"
      className="along-surface-card"
      data-testid="weeks-focus-card"
    >
      <h2 className="font-serif text-xl font-medium text-foreground">This week&apos;s focus</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      {"reviewResurface" in result && result.reviewResurface != null ? (
        <p className="mt-1 text-xs text-muted-foreground" data-testid="weeks-focus-review-hint">
          Last seen {result.reviewResurface.lastSeenDaysAgo} day
          {result.reviewResurface.lastSeenDaysAgo === 1 ? "" : "s"} ago — due for a quick review.
        </p>
      ) : null}
      <Link
        className="along-primary-cta mt-4 min-h-0 px-6 py-3 text-sm"
        data-testid="weeks-focus-cta"
        href={`/app/lesson/${encodeURIComponent(result.slug)}?source=weekly_focus`}
      >
        {result.title}
      </Link>
    </section>
  );
}
