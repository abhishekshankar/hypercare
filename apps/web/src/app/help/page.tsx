import Link from "next/link";

import { Checklist } from "@/components/help/Checklist";
import { RightNowCards } from "@/components/help/RightNowCards";
import { ScreenHeader } from "@/components/screen-header";
import { WHEN_TO_CALL_911, WHEN_TO_CALL_DOCTOR } from "@/lib/help/checklists";

export default function HelpPage() {
  return (
    <>
      <ScreenHeader
        subHeadline="Crisis resources, checklists, and a private caregiver burnout self-check. Always a tap away in the top nav."
        title="Help & Safety"
      />
      <div className="space-y-10 text-foreground" data-testid="help-page">
        <section aria-labelledby="help-right-now" className="space-y-3">
          <h2 className="font-serif text-2xl font-normal text-foreground" id="help-right-now">
            Right now
          </h2>
          <p className="text-sm text-muted-foreground">Tap to call on your phone, or use your carrier&apos;s text app for 741741.</p>
          <RightNowCards />
        </section>

        <section aria-labelledby="help-checklists" className="space-y-3" data-testid="help-checklists">
          <h2 className="font-serif text-2xl font-normal text-foreground" id="help-checklists">
            Checklists
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Checklist items={WHEN_TO_CALL_DOCTOR} testId="checklist-doctor" title="When to call the doctor" />
            <Checklist items={WHEN_TO_CALL_911} testId="checklist-911" title="When to call 911" />
          </div>
        </section>

        <section aria-labelledby="help-burnout" className="space-y-3" data-testid="help-burnout-cta">
          <h2 className="font-serif text-2xl font-normal text-foreground" id="help-burnout">
            Caregiver burnout
          </h2>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-base text-foreground">Take the burnout self-check</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Seven short questions, private to you. No score is kept over time in this version.
            </p>
            <Link
              className="mt-3 inline-block min-h-11 min-w-[12rem] rounded-md bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-foreground no-underline outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent"
              data-testid="help-burnout-link"
              href="/help/burnout-check"
            >
              Start the self-check
            </Link>
          </div>
        </section>

        <footer className="space-y-3 border-t border-border pt-8" data-testid="help-footer">
          <h2 className="font-serif text-2xl font-normal text-foreground">More</h2>
          <p className="text-sm text-foreground">
            <span className="font-medium">Product support:</span>{" "}
            <a
              className="text-accent underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              href="mailto:support@hypercare.app"
            >
              Email us at support@hypercare.app
            </a>
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">About this product:</span>{" "}
            <Link
              className="text-accent underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              href="/about"
            >
              About Hypercare
            </Link>{" "}
            (summary page — v0)
          </p>
        </footer>
      </div>
    </>
  );
}
