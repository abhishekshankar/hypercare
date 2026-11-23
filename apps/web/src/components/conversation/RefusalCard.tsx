"use client";

import Link from "next/link";
import type { RefusalReason } from "@alongside/rag";

import { REFUSAL_COPY, REFUSAL_HEADINGS } from "@/lib/conversation/refusal-copy";

/**
 * Card for every non-safety refusal. The `safety_triaged` reason is rendered
 * by `TriageCard` instead — calling RefusalCard with it is a programming
 * error (we throw at runtime so it cannot silently degrade to a generic
 * card and bury the escalation copy).
 */
export function RefusalCard({ reason }: Readonly<{ reason: RefusalReason }>) {
  if (reason.code === "safety_triaged") {
    throw new Error(
      "RefusalCard does not render safety_triaged refusals — use TriageCard instead.",
    );
  }
  const copy = REFUSAL_COPY[reason.code];
  const heading = REFUSAL_HEADINGS[reason.code];

  return (
    <div
      aria-label={heading}
      className="rounded-lg border border-border bg-muted/40 px-5 py-4"
      data-refusal-code={reason.code}
      data-testid="refusal-card"
      role="region"
    >
      <p className="font-serif text-lg text-foreground">{heading}</p>
      <p className="mt-2 text-base leading-relaxed text-foreground/90">{copy.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link
          className="text-accent underline-offset-2 outline-none ring-offset-background hover:underline focus-visible:ring-2 focus-visible:ring-accent"
          href="/help"
        >
          See resources
        </Link>
        {copy.secondaryActionLabel ? (
          <button
            className="text-muted-foreground underline-offset-2 outline-none ring-offset-background hover:underline hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="refusal-secondary-action"
            onClick={() => {
              // v0: feedback is a no-op (TASK-011 OOS). Logged for visibility.
              console.info("refusal.report_clicked", { code: reason.code });
            }}
            type="button"
          >
            {copy.secondaryActionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
