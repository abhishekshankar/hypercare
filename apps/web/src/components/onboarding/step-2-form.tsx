"use client";

import Link from "next/link";

import { submitOnboardingStep2 } from "@/app/(authed)/onboarding/_actions";
import { StageV1Fields } from "@/components/care-profile/stage-v1-fields";
import { getStage2DefaultsForProfile } from "@/lib/onboarding/stage2-defaults";
import type { CareProfileRow } from "@/lib/onboarding/status";

import { OnboardingStepForm } from "./onboarding-step-form";

type Props = {
  crFirstName: string;
  profile: CareProfileRow | null;
};

export function Step2Form({ crFirstName, profile }: Props) {
  const defaults = getStage2DefaultsForProfile(profile);
  return (
    <OnboardingStepForm action={submitOnboardingStep2}>
      {({ pending, errors }) => (
        <>
          <StageV1Fields
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
