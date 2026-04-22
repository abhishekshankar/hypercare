import Link from "next/link";

/**
 * Shown in place of weekly focus + check-in when `user_suppression` is active (TASK-025).
 * Copy is aligned with `packages/safety/src/scripts/_suppression-home-card.md`.
 */
export function SuppressionCard() {
  return (
    <section
      aria-label="Gentle support"
      className="rounded-lg border border-border bg-muted/30 px-4 py-5"
      data-testid="suppression-card"
    >
      <h2 className="font-serif text-lg font-medium text-foreground">I’m here when you’re ready</h2>
      <p className="mt-2 text-sm leading-relaxed text-foreground">
        It’s okay if you are not up for lessons or a weekly nudge right now. When you want support,
        the helplines below are one tap away — we’re not going anywhere.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <a className="font-medium text-accent underline-offset-2 hover:underline" href="tel:988">
            988
          </a>{" "}
          — Suicide &amp; Crisis Lifeline
        </li>
        <li>
          <a className="font-medium text-accent underline-offset-2 hover:underline" href="tel:8002723900">
            800-272-3900
          </a>{" "}
          — Alzheimer&apos;s Association 24/7 helpline
        </li>
        <li>
          <a className="font-medium text-accent underline-offset-2 hover:underline" href="tel:911">
            911
          </a>{" "}
          — Emergencies
        </li>
        <li>
          <a className="font-medium text-accent underline-offset-2 hover:underline" href="tel:18006771116">
            1-800-677-1116
          </a>{" "}
          — Eldercare Locator
        </li>
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        <Link className="underline-offset-2 hover:underline" href="/help">
          More on Help &amp; safety
        </Link>
      </p>
    </section>
  );
}
