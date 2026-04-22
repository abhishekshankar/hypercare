"use client";

import Link from "next/link";

import { submitOnboardingStep4 } from "@/app/(authed)/onboarding/_actions";

import { OnboardingStepForm } from "./onboarding-step-form";

type Defaults = {
  displayName: string;
  caregiverAgeBracket: string | null;
  caregiverWorkStatus: string | null;
  caregiverState1_5: number | null;
  hardestThing: string | null;
};

type Props = {
  defaults: Defaults;
};

const STATE_LABELS: Record<number, string> = {
  1: "I've got this",
  2: "Mostly okay, with rough patches",
  3: "Stretched thin",
  4: "Running on empty",
  5: "I'm at the end of my rope",
};

export function Step4Form({ defaults }: Props) {
  return (
    <OnboardingStepForm action={submitOnboardingStep4}>
      {({ pending, errors }) => (
        <>
          <div className="space-y-6">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="field-display_name">
                Your first name
              </label>
              <input
                aria-describedby={errors.display_name ? "error-display_name" : undefined}
                aria-invalid={errors.display_name ? true : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
                defaultValue={defaults.displayName}
                disabled={pending}
                id="field-display_name"
                name="display_name"
                required
                type="text"
              />
              {errors.display_name ? (
                <p className="mt-1 text-sm text-destructive" id="error-display_name" role="alert">
                  {errors.display_name}
                </p>
              ) : null}
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Your age bracket</legend>
              {(
                [
                  ["under_40", "Under 40"],
                  ["40_54", "40–54"],
                  ["55_64", "55–64"],
                  ["65_74", "65–74"],
                  ["75_plus", "75+"],
                ] as const
              ).map(([value, label]) => (
                <div className="flex items-center gap-2" key={value}>
                  <input
                    aria-describedby={
                      errors.caregiver_age_bracket ? "error-caregiver_age_bracket" : undefined
                    }
                    className="size-4 border-input text-accent"
                    defaultChecked={defaults.caregiverAgeBracket === value}
                    disabled={pending}
                    id={`field-caregiver_age_bracket-${value}`}
                    name="caregiver_age_bracket"
                    type="radio"
                    value={value}
                  />
                  <label className="text-sm" htmlFor={`field-caregiver_age_bracket-${value}`}>
                    {label}
                  </label>
                </div>
              ))}
              {errors.caregiver_age_bracket ? (
                <p
                  className="text-sm text-destructive"
                  id="error-caregiver_age_bracket"
                  role="alert"
                >
                  {errors.caregiver_age_bracket}
                </p>
              ) : null}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Work status</legend>
              {(
                [
                  ["working", "Working"],
                  ["retired", "Retired"],
                  ["other", "Other"],
                ] as const
              ).map(([value, label]) => (
                <div className="flex items-center gap-2" key={value}>
                  <input
                    aria-describedby={
                      errors.caregiver_work_status ? "error-caregiver_work_status" : undefined
                    }
                    className="size-4 border-input text-accent"
                    defaultChecked={defaults.caregiverWorkStatus === value}
                    disabled={pending}
                    id={`field-caregiver_work_status-${value}`}
                    name="caregiver_work_status"
                    type="radio"
                    value={value}
                  />
                  <label className="text-sm" htmlFor={`field-caregiver_work_status-${value}`}>
                    {label}
                  </label>
                </div>
              ))}
              {errors.caregiver_work_status ? (
                <p
                  className="text-sm text-destructive"
                  id="error-caregiver_work_status"
                  role="alert"
                >
                  {errors.caregiver_work_status}
                </p>
              ) : null}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">How are you doing right now?</legend>
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <div className="flex items-center gap-2" key={n}>
                  <input
                    aria-describedby={
                      errors.caregiver_state_1_5 ? "error-caregiver_state_1_5" : undefined
                    }
                    className="size-4 border-input text-accent"
                    defaultChecked={defaults.caregiverState1_5 === n}
                    disabled={pending}
                    id={`field-caregiver_state_1_5-${n}`}
                    name="caregiver_state_1_5"
                    type="radio"
                    value={String(n)}
                  />
                  <label className="text-sm" htmlFor={`field-caregiver_state_1_5-${n}`}>
                    {n} — {STATE_LABELS[n]}
                  </label>
                </div>
              ))}
              {errors.caregiver_state_1_5 ? (
                <p
                  className="text-sm text-destructive"
                  id="error-caregiver_state_1_5"
                  role="alert"
                >
                  {errors.caregiver_state_1_5}
                </p>
              ) : null}
            </fieldset>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="field-hardest_thing">
                What&apos;s the hardest thing right now?{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                aria-describedby={errors.hardest_thing ? "error-hardest_thing" : undefined}
                aria-invalid={errors.hardest_thing ? true : undefined}
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
                defaultValue={defaults.hardestThing ?? ""}
                disabled={pending}
                id="field-hardest_thing"
                maxLength={500}
                name="hardest_thing"
              />
              {errors.hardest_thing ? (
                <p className="mt-1 text-sm text-destructive" id="error-hardest_thing" role="alert">
                  {errors.hardest_thing}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <Link
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              href="/onboarding/step/3"
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
