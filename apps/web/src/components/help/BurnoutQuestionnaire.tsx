"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { BURNOUT_LIKERT_LABELS, BURNOUT_QUESTIONS } from "@/lib/help/burnout-questions";
import { scoreBurnout } from "@/lib/help/burnout-score";
import { BurnoutResultCard } from "./BurnoutResultCard";

const QN = 7 as const;

export function BurnoutQuestionnaire() {
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(Array.from({ length: QN }, () => null));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof scoreBurnout> | null>(null);
  const [loading, setLoading] = useState(false);
  const allAnswered = answers.every((a) => a !== null);
  const setAnswer = (index: number, value: number) => {
    setError(null);
    setResult(null);
    setAnswers((prev) => {
      const next = [...prev] as (number | null)[];
      next[index] = value;
      return next;
    });
  };

  async function onSubmit() {
    if (!allAnswered) {
      setError("Please answer all questions before submitting.");
      return;
    }
    const raw = answers as number[];
    let scored: ReturnType<typeof scoreBurnout>;
    try {
      scored = scoreBurnout(raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not score answers.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/app/help/burnout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: raw }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }
    setResult(scored);
    setLoading(false);
    router.refresh();
  }

  if (result) {
    return <BurnoutResultCard band={result.band} score={result.score} />;
  }

  return (
    <div className="space-y-6" data-testid="burnout-questionnaire">
      {BURNOUT_QUESTIONS.map((q, i) => (
        <fieldset key={i} className="space-y-2 border-0 p-0">
          <legend className="text-base text-foreground">
            <span className="text-muted-foreground"> {i + 1}. </span>
            {q}
          </legend>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:flex-wrap" role="radiogroup" aria-label={`Question ${i + 1}`}>
            {BURNOUT_LIKERT_LABELS.map((label, value) => {
              const id = `burnout-q${i}-v${value}`;
              return (
                <div key={value} className="flex items-center gap-2">
                  <input
                    checked={answers[i] === value}
                    className="h-4 w-4 border-border text-accent focus:ring-2 focus:ring-accent"
                    data-testid={`burnout-q${i}-option-${value}`}
                    id={id}
                    name={`burnout-q${i}`}
                    onChange={() => setAnswer(i, value)}
                    type="radio"
                    value={value}
                  />
                  <label className="text-sm text-foreground" htmlFor={id}>
                    {label}
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
      {error ? <p className="text-sm text-rose-800">{error}</p> : null}
      <button
        className="inline-flex min-h-11 min-w-[8rem] items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="burnout-submit"
        disabled={loading}
        onClick={onSubmit}
        type="button"
      >
        {loading ? "Saving…" : "See my results"}
      </button>
    </div>
  );
}
