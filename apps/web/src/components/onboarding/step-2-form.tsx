"use client";

import Link from "next/link";

import { submitOnboardingStep2 } from "@/app/(authed)/onboarding/_actions";
import { StageFields } from "@/components/care-profile/stage-fields";
import type { StageAnswersRecord } from "@/lib/onboarding/stage-keys";

import { OnboardingStepForm } from "./onboarding-step-form";

type Props = {
  crFirstName: string;
  defaults: StageAnswersRecord;
};

export function Step2Form({ crFirstName, defaults }: Props) {
  return (
    <OnboardingStepForm action={submitOnboardingStep2}>
      {({ pending, errors }) => (
        <>
          <StageFields
            crFirstName={crFirstName}
            defaults={defaults}
            errors={errors}
            pending={pending}
          />

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
