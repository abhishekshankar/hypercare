import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OnboardingMicrocopy } from "@/components/onboarding/onboarding-microcopy";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { requireSession } from "@/lib/auth/session";
import { composeOnboardingSummary } from "@/lib/onboarding/summary";
import {
  displayNameForProfileWizard,
  getFirstIncompleteStep,
  hasCompletedOnboarding,
  isWizardDataCompleteFromSnapshot,
  loadProfileBundle,
} from "@/lib/onboarding/status";

import { confirmOnboardingSummary } from "../_actions";

export const metadata: Metadata = {
  title: "Onboarding — summary",
};

export default async function OnboardingSummaryPage() {
  const session = await requireSession();
  if (await hasCompletedOnboarding(session.userId)) {
    redirect("/app");
  }
  const { user, profile, membership } = await loadProfileBundle(session.userId);
  const disp = displayNameForProfileWizard(user, membership);
  if (!isWizardDataCompleteFromSnapshot(profile, disp)) {
    const step = getFirstIncompleteStep(profile, disp) ?? 1;
    redirect(`/onboarding/step/${step}`);
  }

  const paragraph = composeOnboardingSummary({
    displayName: disp ?? "",
    profile: profile!,
  });

  return (
    <>
      <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">
        Here&apos;s what we heard
      </h1>
      <OnboardingProgress step={5} />
      <OnboardingMicrocopy />
      <p className="mb-8 text-base leading-relaxed text-foreground">{paragraph}</p>
      <div className="flex flex-wrap items-center gap-4">
        <form action={confirmOnboardingSummary}>
          <button
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground outline-none ring-offset-background hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent"
            type="submit"
          >
            Looks right
          </button>
        </form>
        <Link
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href="/onboarding/step/1"
        >
          Edit
        </Link>
      </div>
    </>
  );
}
