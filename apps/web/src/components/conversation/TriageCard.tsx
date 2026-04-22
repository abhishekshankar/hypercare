"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { SafetyTriageReason } from "@hypercare/rag";

import { setCrisisStripPulse } from "@/components/crisis-strip-pulse";

/**
 * The dedicated UI for `safety_triaged` refusals (TASK-011 §"Refusal UX",
 * red row of the table). This is a first-class component, not a styling
 * variant of RefusalCard, because:
 *
 *  1. Action precedence: the primary CTA is a `tel:` link to 988/911/APS
 *     (PRD §10.3). It must be the loudest control on the page — at the
 *     top, large hit area, no peer with similar weight underneath.
 *  2. No grounded body. We do NOT show a generic answer or fallback copy
 *     beneath. The user is in a crisis posture; one screen, one action.
 *  3. CrisisStrip pulse. We add `data-pulse="true"` on the persistent
 *     crisis strip for the lifetime of this card (cleared on unmount), so
 *     the user has a second visual anchor to call resources beyond the
 *     primary CTA.
 *  4. Analytics placeholder. v0 logs `console.info`; a follow-up ticket
 *     will route to CloudWatch via the structured logger.
 */

type ActionDescriptor = {
  label: string;
  href: string;
  /** A11y description of what tapping does. */
  description: string;
};

const ACTIONS = {
  call_988: {
    label: "Call 988",
    href: "tel:988",
    description: "Suicide & Crisis Lifeline (US, 24/7).",
  },
  call_911: {
    label: "Call 911",
    href: "tel:911",
    description: "Emergency services (US, 24/7).",
  },
  call_adult_protective_services: {
    label: "Call Adult Protective Services",
    href: "tel:18006771116",
    description:
      "Eldercare Locator routes you to your state APS line (1-800-677-1116, weekdays 9am–8pm ET).",
  },
  show_crisis_strip_emphasis: {
    label: "Call the 24/7 helpline",
    href: "tel:8002723900",
    description: "Alzheimer’s Association 24/7 helpline.",
  },
} as const satisfies Record<SafetyTriageReason["suggestedAction"], ActionDescriptor>;

const HEADINGS = {
  self_harm_user: "Reach out for help right now",
  self_harm_cr: "Reach out for help right now",
  acute_medical: "This sounds like a medical emergency",
  abuse_caregiver_to_cr: "Stop and call for help",
  abuse_cr_to_caregiver: "You don’t have to handle this alone",
  neglect: "Let’s get help in place",
} as const satisfies Record<SafetyTriageReason["category"], string>;

export function TriageCard({
  reason,
  drivesCrisisStrip,
}: Readonly<{
  reason: SafetyTriageReason;
  /**
   * Pass `true` only when this triage is the **latest** assistant turn and should
   * drive the global strip. Omitting or defaulting to “on” is unsafe (strip stuck
   * on) if the card is ever mounted in a new code path; required props force a choice.
   */
  drivesCrisisStrip: boolean;
}>) {
  const action = ACTIONS[reason.suggestedAction];
  const heading = HEADINGS[reason.category];

  useEffect(() => {
    console.info("safety.triage.rendered", {
      category: reason.category,
      severity: reason.severity,
      suggestedAction: reason.suggestedAction,
      source: reason.source,
    });
    if (!drivesCrisisStrip) return;
    setCrisisStripPulse(true);
    return () => setCrisisStripPulse(false);
  }, [
    drivesCrisisStrip,
    reason.category,
    reason.severity,
    reason.suggestedAction,
    reason.source,
  ]);

  return (
    <div
      aria-label="Crisis resources"
      className="rounded-lg border-2 border-red-500/70 bg-red-50 px-5 py-5 text-red-950"
      data-severity={reason.severity}
      data-testid="triage-card"
      data-triage-category={reason.category}
      role="alertdialog"
    >
      <p className="font-serif text-xl">{heading}</p>
      <p className="mt-2 text-sm leading-relaxed text-red-900">
        Hypercare can’t answer this — please reach a person who can help right now.
      </p>
      <div className="mt-4">
        <a
          className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-3 text-base font-medium text-white outline-none ring-offset-red-50 transition hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-700"
          data-testid="triage-primary-action"
          href={action.href}
        >
          {action.label}
        </a>
        <p className="mt-2 text-xs text-red-900/80">{action.description}</p>
      </div>
      <div className="mt-4 border-t border-red-300/60 pt-3 text-sm">
        <Link
          className="text-red-800 underline-offset-2 hover:underline"
          href="/help"
        >
          See more resources
        </Link>
      </div>
    </div>
  );
}
