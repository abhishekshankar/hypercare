"use client";

import { AboutCrFields } from "@/components/care-profile/about-cr-fields";
import { submitOnboardingStep1 } from "@/app/(authed)/onboarding/_actions";

import { OnboardingStepForm } from "./onboarding-step-form";

type Defaults = {
  crFirstName: string;
  crAge: number | null;
  crRelationship: string;
  crDiagnosis: string | null;
  crDiagnosisYear: number | null;
};

type Props = {
  defaults: Defaults;
};

export function Step1Form({ defaults }: Props) {
  return (
    <OnboardingStepForm action={submitOnboardingStep1}>
      {({ pending, errors }) => (
        <>
          <AboutCrFields defaults={defaults} errors={errors} pending={pending} />

          <div className="mt-8 flex justify-end">
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
