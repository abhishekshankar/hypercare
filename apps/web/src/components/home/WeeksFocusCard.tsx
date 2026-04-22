import Link from "next/link";

import type { PickerResult } from "@hypercare/picker";

export function WeeksFocusCard(props: Readonly<{ result: PickerResult; subtitle: string }>) {
  const { result, subtitle } = props;
  if (result.kind !== "pick") {
    return (
      <section
        aria-label="This week's focus"
        className="rounded-xl border border-border bg-muted/20 p-5"
        data-testid="weeks-focus-card"
      >
        <h2 className="font-serif text-lg font-medium text-foreground">This week&apos;s focus</h2>
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
      className="rounded-xl border border-border bg-muted/20 p-5"
      data-testid="weeks-focus-card"
    >
      <h2 className="font-serif text-lg font-medium text-foreground">This week&apos;s focus</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      {"reviewResurface" in result && result.reviewResurface != null ? (
        <p className="mt-1 text-xs text-muted-foreground" data-testid="weeks-focus-review-hint">
          Last seen {result.reviewResurface.lastSeenDaysAgo} day
          {result.reviewResurface.lastSeenDaysAgo === 1 ? "" : "s"} ago — due for a quick review.
        </p>
      ) : null}
      <Link
        className="mt-3 inline-flex rounded-md border border-accent bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid="weeks-focus-cta"
        href={`/app/lesson/${encodeURIComponent(result.slug)}?source=weekly_focus`}
      >
        {result.title}
      </Link>
    </section>
  );
}
