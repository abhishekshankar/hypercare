"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CheckinCard() {
  const router = useRouter();
  const [step, setStep] = useState<"ask" | "detail" | "done">("ask");
  const [tried, setTried] = useState<boolean | null>(null);
  const [whatHelped, setWhatHelped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (step === "done") {
    return null;
  }

  async function submitSkip() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/app/checkin/skip", { method: "POST" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setStep("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save");
    } finally {
      setPending(false);
    }
  }

  async function submitAnswer() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/app/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tried_something: tried,
          what_helped: whatHelped.trim().length > 0 ? whatHelped.trim() : undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setStep("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save");
    } finally {
      setPending(false);
    }
  }

  if (step === "ask") {
    return (
      <section
        aria-label="Weekly check-in"
        className="rounded-xl border border-border bg-background p-5 shadow-sm"
        data-testid="weekly-checkin-card"
      >
        <h2 className="font-serif text-lg font-medium text-foreground">How are you doing this week?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Did you try something that helped?</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            disabled={pending}
            onClick={() => {
              setTried(true);
              setStep("detail");
            }}
            type="button"
          >
            Yes
          </button>
          <button
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            disabled={pending}
            onClick={() => {
              setTried(false);
              setStep("detail");
            }}
            type="button"
          >
            No
          </button>
          <button
            className="rounded-md border border-transparent px-4 py-2 text-sm text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
            disabled={pending}
            onClick={() => void submitSkip()}
            type="button"
          >
            Skip
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-label="Weekly check-in"
      className="rounded-xl border border-border bg-background p-5 shadow-sm"
      data-testid="weekly-checkin-card"
    >
      <p className="text-sm text-foreground">What helped? (optional)</p>
      <label className="sr-only" htmlFor="checkin-what-helped">
        What helped
      </label>
      <textarea
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        id="checkin-what-helped"
        onChange={(e) => setWhatHelped(e.target.value)}
        placeholder="A few words is enough…"
        rows={2}
        value={whatHelped}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded-md border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          disabled={pending}
          onClick={() => void submitAnswer()}
          type="button"
        >
          Save
        </button>
        <button
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted/60 disabled:opacity-50"
          disabled={pending}
          onClick={() => setStep("ask")}
          type="button"
        >
          Back
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
