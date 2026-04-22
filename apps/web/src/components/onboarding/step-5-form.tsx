"use client";

import Link from "next/link";

import { submitOnboardingStep5 } from "@/app/(authed)/onboarding/_actions";
import { WhatMattersFields } from "@/components/care-profile/what-matters-fields";

import { OnboardingStepForm } from "./onboarding-step-form";

type Defaults = {
  crBackground: string | null;
  crJoy: string | null;
  crPersonalityNotes: string | null;
};

type Props = {
  crFirstName: string;
  defaults: Defaults;
};

export function Step5Form({ crFirstName, defaults }: Props) {
  return (
    <OnboardingStepForm action={submitOnboardingStep5}>
      {({ pending, errors }) => (
        <>
          <WhatMattersFields
            crFirstName={crFirstName}
            defaults={defaults}
            errors={errors}
            pending={pending}
          />

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <Link
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              href="/onboarding/step/4"
            >
              Back
            </Link>
            <button
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground outline-none ring-offset-background hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              disabled={pending}
              type="submit"
            >
              {pending ? "Saving…" : "See what I told Hypercare."}
            </button>
          </div>
        </>
      )}
    </OnboardingStepForm>
  );
}
