"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

const KINDS = [
  { v: "off_reply" as const, label: "Something felt off in a reply" },
  { v: "not_found" as const, label: "I couldn't find what I needed" },
  { v: "suggestion" as const, label: "I want to suggest something" },
  { v: "other" as const, label: "Other" },
];

export function HelpFeedbackForm() {
  const router = useRouter();
  const id = useId();
  const [kind, setKind] = useState<(typeof KINDS)[number]["v"]>("not_found");
  const [body, setBody] = useState("");
  const [includeContext, setIncludeContext] = useState(false);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (body.trim().length === 0) {
      setErr("Please add a short note.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/app/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          body: body.trim(),
          include_context: includeContext,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      router.push("/app?feedback=thanks");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Could not send");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground" htmlFor={`${id}-kind`}>
          What&apos;s going on?
        </label>
        <select
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          id={`${id}-kind`}
          onChange={(e) => setKind(e.target.value as (typeof KINDS)[number]["v"])}
          value={kind}
        >
          {KINDS.map((k) => (
            <option key={k.v} value={k.v}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground" htmlFor={`${id}-body`}>
          Details (up to 2000 characters)
        </label>
        <textarea
          className="min-h-32 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          id={`${id}-body`}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          value={body}
        />
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
        <input
          checked={includeContext}
          className="mt-1"
          onChange={(e) => setIncludeContext(e.target.checked)}
          type="checkbox"
        />
        <span>Include the last conversation with my message so the team can see the context</span>
      </label>
      {err != null ? <p className="text-sm text-destructive">{err}</p> : null}
      <button
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
