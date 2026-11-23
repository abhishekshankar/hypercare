import Link from "next/link";

export function WarmCompanionCard({
  slug,
  title,
  tryThisToday,
}: Readonly<{
  slug: string;
  title: string;
  tryThisToday: string | null;
}>) {
  return (
    <section
      aria-label="Suggested reading"
      className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-4 py-4 text-foreground"
      data-testid="warm-companion-appendix"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-amber-900/80">For you right now</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Other caregivers in your situation often find this helpful around now.
      </p>
      <p className="mt-2 font-serif text-lg font-medium text-foreground">{title}</p>
      {tryThisToday ? <p className="mt-1 text-sm text-muted-foreground">{tryThisToday}</p> : null}
      <Link
        className="mt-3 inline-flex text-sm font-medium text-accent underline-offset-2 hover:underline"
        href={`/app/modules/${slug}`}
      >
        Open this module
      </Link>
    </section>
  );
}
