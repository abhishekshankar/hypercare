"use client";

import Link from "next/link";

import { submitOnboardingStep3 } from "@/app/(authed)/onboarding/_actions";
import { LivingFields } from "@/components/care-profile/living-fields";

import { OnboardingStepForm } from "./onboarding-step-form";

type Defaults = {
  livingSituation: string | null;
  careNetwork: string | null;
  careHoursPerWeek: number | null;
  caregiverProximity: string | null;
};

type Props = {
  defaults: Defaults;
};

export function Step3Form({ defaults }: Props) {
  return (
    <OnboardingStepForm action={submitOnboardingStep3}>
      {({ pending, errors }) => (
        <>
          <LivingFields defaults={defaults} errors={errors} pending={pending} />

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <Link
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              href="/onboarding/step/2"
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
