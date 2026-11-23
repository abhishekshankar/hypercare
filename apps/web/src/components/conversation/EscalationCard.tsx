"use client";

import Link from "next/link";
import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { SafetyEscalationScript, SafetyTriageReason } from "@alongside/rag";

import { setCrisisStripPulse } from "@/components/crisis-strip-pulse";

type EnrichedTriage = SafetyTriageReason & { script: SafetyEscalationScript };
type ResourceLine = SafetyEscalationScript["primary_resources"][number];

type Props = Readonly<{
  reason: EnrichedTriage;
  drivesCrisisStrip: boolean;
}>;

export function EscalationCard({ reason, drivesCrisisStrip }: Props) {
  const { script } = reason;

  useEffect(() => {
    if (!drivesCrisisStrip) return;
    setCrisisStripPulse(true);
    return () => setCrisisStripPulse(false);
  }, [drivesCrisisStrip, reason.category]);

  const primary = script.primary_resources.filter((r: ResourceLine) => r.primary);
  const secondary = script.primary_resources.filter((r: ResourceLine) => !r.primary);

  return (
    <div
      aria-label="Crisis resources"
      className="rounded-lg border-2 border-red-500/70 bg-red-50 px-5 py-5 text-red-950"
      data-severity={reason.severity}
      data-testid="escalation-card"
      data-triage-category={reason.category}
      role="alertdialog"
    >
      <p className="font-serif text-lg font-medium leading-snug text-red-950">{script.direct_answer}</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {primary.map((r: ResourceLine) => (
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-600 px-4 py-3 text-center text-base font-medium text-white outline-none ring-offset-red-50 transition hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-700"
            data-testid="escalation-primary-resource"
            href={r.href}
            key={r.label}
            rel={r.href.startsWith("http") ? "noopener noreferrer" : undefined}
            target={r.href.startsWith("http") ? "_blank" : undefined}
          >
            {r.label}
          </a>
        ))}
        {secondary.map((r: ResourceLine) => (
          <a
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100"
            href={r.href}
            key={r.label}
            rel={r.href.startsWith("http") ? "noopener noreferrer" : undefined}
            target={r.href.startsWith("http") ? "_blank" : undefined}
          >
            {r.label}
          </a>
        ))}
      </div>

      {script.body_md ? (
        <div className="prose prose-sm mt-4 max-w-none text-red-900 prose-p:my-2">
          <ReactMarkdown>{script.body_md}</ReactMarkdown>
        </div>
      ) : null}

      {script.disclosure ? (
        <p className="mt-4 border-t border-red-300/60 pt-3 text-sm text-red-900">{script.disclosure}</p>
      ) : null}

      <p className="mt-4 text-xs text-red-800/80">
        This response is pre-written and reviewed by {script.reviewed_by} on         {script.reviewed_on}
        {"repeat_in_window" in reason && reason.repeat_in_window
          ? " · Follow-up in the last few minutes was counted with your earlier triage."
          : null}
      </p>

      <p className="mt-2 text-sm">
        <Link
          className="text-red-800 underline-offset-2 hover:underline"
          href="/help"
        >
          See more resources
        </Link>
      </p>
    </div>
  );
}
