"use client";

import Link from "next/link";

import { submitOnboardingStep2 } from "@/app/(authed)/onboarding/_actions";
import type { StageAnswersRecord } from "@/lib/onboarding/stage-keys";
import { STAGE_ANSWER_KEYS } from "@/lib/onboarding/stage-keys";

import { OnboardingStepForm } from "./onboarding-step-form";

const QUESTIONS: { key: (typeof STAGE_ANSWER_KEYS)[number]; text: (name: string) => string }[] = [
  {
    key: "manages_meds",
    text: (name) => `Can ${name} manage their own medications?`,
  },
  {
    key: "drives",
    text: (name) => `Does ${name} still drive? If not, when did they stop?`,
  },
  {
    key: "left_alone",
    text: (name) => `Can ${name} be left alone safely for a few hours?`,
  },
  {
    key: "recognizes_you",
    text: (name) => `Does ${name} recognize you most of the time?`,
  },
  {
    key: "bathes_alone",
    text: (name) => `Can ${name} bathe and dress without help?`,
  },
  {
    key: "wandering_incidents",
    text: (name) => `Has ${name} had incidents of getting lost or wandering?`,
  },
  {
    key: "conversations",
    text: (name) => `Does ${name} still carry on conversations that make sense to you?`,
  },
  {
    key: "sleeps_through_night",
    text: (name) => `Does ${name} sleep through the night usually?`,
  },
];

type Props = {
  crFirstName: string;
  defaults: StageAnswersRecord;
};

export function Step2Form({ crFirstName, defaults }: Props) {
  const name = crFirstName.trim().length > 0 ? crFirstName.trim() : "they";
  return (
    <OnboardingStepForm action={submitOnboardingStep2}>
      {({ pending, errors }) => (
        <>
          <div className="space-y-8">
            {QUESTIONS.map(({ key, text }) => (
              <fieldset className="space-y-2" key={key}>
                <legend className="mb-1 text-sm font-medium text-foreground">{text(name)}</legend>
                {(
                  [
                    ["yes", "Yes"],
                    ["no", "No"],
                    ["unsure", "Unsure"],
                  ] as const
                ).map(([value, label]) => (
                  <div className="flex items-center gap-2" key={value}>
                    <input
                      aria-describedby={errors[key] ? `error-${key}` : undefined}
                      className="size-4 border-input text-accent"
                      defaultChecked={defaults[key] === value}
                      disabled={pending}
                      id={`field-${key}-${value}`}
                      name={key}
                      type="radio"
                      value={value}
                    />
                    <label className="text-sm" htmlFor={`field-${key}-${value}`}>
                      {label}
                    </label>
                  </div>
                ))}
                {errors[key] ? (
                  <p className="text-sm text-destructive" id={`error-${key}`} role="alert">
                    {errors[key]}
                  </p>
                ) : null}
              </fieldset>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <Link
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              href="/onboarding/step/1"
            >
              Back
            </Link>
            <button
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground outline-none ring-offset-background hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              disabled={pending}
              type="submit"
            >
              {pending ? "Saving…" : "Continue"}
            </button>
          </div>
        </>
      )}
    </OnboardingStepForm>
  );
}
