import Link from "next/link";
import type { BurnoutBand } from "@/lib/help/burnout-score";

type BurnoutResultCardProps = Readonly<{
  band: BurnoutBand;
  /** Total score 0–28; shown in all bands. */
  score: number;
}>;

function bandVisual(band: BurnoutBand) {
  switch (band) {
    case "green":
      return { label: "Look okay for now", ring: "border-emerald-800/30 bg-emerald-50" };
    case "amber":
      return { label: "Signs to pay attention to", ring: "border-amber-800/30 bg-amber-50" };
    case "red":
    case "red_severe":
      return { label: "Prioritize your own care", ring: "border-rose-800/30 bg-rose-50" };
  }
}

export function BurnoutResultCard({ band, score }: BurnoutResultCardProps) {
  const v = bandVisual(band);
  return (
    <div
      className={`rounded-lg border-2 p-4 ${v.ring} text-foreground shadow-sm`}
      data-testid="burnout-result"
      role="status"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-foreground/80">{v.label}</p>
      <p className="mt-1 text-sm text-foreground/90">
        <span className="font-mono font-semibold">{score} out of 28</span>
        {band === "green" && " — overall score is on the lower side right now."}
        {band === "amber" && " — you’re in a range where a little more support can help."}
        {(band === "red" || band === "red_severe") && " — this range suggests strong burnout signals."}
      </p>
      {band === "green" && (
        <div className="mt-3 space-y-2 text-sm leading-relaxed">
          <p>
            You’re carrying a lot, and it sounds like you&apos;ve got enough in the tank for now. Here&apos;s what to
            keep an eye on: sleep, eating regularly, and one small break a week that&apos;s just for you — even
            15 minutes counts.
          </p>
          <p className="text-muted-foreground">Consider taking this check again in about two weeks, or any time things feel worse.</p>
        </div>
      )}
      {band === "amber" && (
        <div className="mt-3 space-y-3 text-sm leading-relaxed">
          <p>
            Caregiver burnout is a real thing, and you&apos;re showing some signs of it. A few things that help many
            people: say one &quot;no&quot; you&apos;ve been avoiding, hand off one task for 24 hours if you can, and
            tell one person the truth about how hard this week was.
          </p>
          <p>
            <Link
              className="text-accent underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              href="/app/modules/caregiver-burnout"
            >
              Open the caregiver-burnout module
            </Link>{" "}
            for a short read (same topic as the conversation picks).
          </p>
        </div>
      )}
      {(band === "red" || band === "red_severe") && (
        <div className="mt-3 space-y-3 text-sm leading-relaxed">
          <p>
            What you&apos;re describing is severe burnout. You don&apos;t have to wait until something breaks. Please
            consider reaching out to one of these:
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <a className="text-accent underline-offset-2 hover:underline" href="tel:+18002723900">
                Alzheimer&apos;s Association 24/7 Helpline: 800-272-3900
              </a>
            </li>
            <li>
              <a className="text-accent underline-offset-2 hover:underline" href="tel:988">
                988 Suicide &amp; Crisis Lifeline (call or text 988)
              </a>
            </li>
          </ul>
        </div>
      )}
      {band === "red_severe" && (
        <div
          className="mt-4 rounded-md border border-rose-800/20 bg-white/50 p-3 text-sm leading-relaxed text-foreground"
          data-testid="burnout-severe-988-cta"
        >
          <p>
            <strong>Important:</strong> If you’re having thoughts of harming yourself or the person you care for, call{" "}
            <a className="font-mono text-accent underline-offset-2 hover:underline" href="tel:988">
              988
            </a>{" "}
            now.
          </p>
        </div>
      )}
    </div>
  );
}
