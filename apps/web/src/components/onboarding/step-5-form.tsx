"use client";

import Link from "next/link";

import { submitOnboardingStep5 } from "@/app/(authed)/onboarding/_actions";

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
  const name = crFirstName.trim().length > 0 ? crFirstName.trim() : "them";
  return (
    <OnboardingStepForm action={submitOnboardingStep5}>
      {({ pending, errors }) => (
        <>
          <div className="space-y-6">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="field-cr_background">
                What did {name} do for work, or what were they known for?{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                aria-describedby={errors.cr_background ? "error-cr_background" : undefined}
                aria-invalid={errors.cr_background ? true : undefined}
                className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
                defaultValue={defaults.crBackground ?? ""}
                disabled={pending}
                id="field-cr_background"
                maxLength={500}
                name="cr_background"
              />
              {errors.cr_background ? (
                <p className="mt-1 text-sm text-destructive" id="error-cr_background" role="alert">
                  {errors.cr_background}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="field-cr_joy">
                What brings {name} joy, even now?{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                aria-describedby={errors.cr_joy ? "error-cr_joy" : undefined}
                aria-invalid={errors.cr_joy ? true : undefined}
                className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
                defaultValue={defaults.crJoy ?? ""}
                disabled={pending}
                id="field-cr_joy"
                maxLength={500}
                name="cr_joy"
              />
              {errors.cr_joy ? (
                <p className="mt-1 text-sm text-destructive" id="error-cr_joy" role="alert">
                  {errors.cr_joy}
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="field-cr_personality_notes"
              >
                Anything about {name}&apos;s personality or history that&apos;s important for me to
                understand? <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                aria-describedby={
                  errors.cr_personality_notes ? "error-cr_personality_notes" : undefined
                }
                aria-invalid={errors.cr_personality_notes ? true : undefined}
                className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
                defaultValue={defaults.crPersonalityNotes ?? ""}
                disabled={pending}
                id="field-cr_personality_notes"
                maxLength={500}
                name="cr_personality_notes"
              />
              {errors.cr_personality_notes ? (
                <p
                  className="mt-1 text-sm text-destructive"
                  id="error-cr_personality_notes"
                  role="alert"
                >
                  {errors.cr_personality_notes}
                </p>
              ) : null}
            </div>
          </div>

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
