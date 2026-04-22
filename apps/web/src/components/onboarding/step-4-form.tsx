"use client";

import Link from "next/link";

import { submitOnboardingStep4 } from "@/app/(authed)/onboarding/_actions";
import { AboutYouFields } from "@/components/care-profile/about-you-fields";

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

export function Step4Form({ defaults }: Props) {
  return (
    <OnboardingStepForm action={submitOnboardingStep4}>
      {({ pending, errors }) => (
        <>
          <AboutYouFields defaults={defaults} errors={errors} pending={pending} />

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
