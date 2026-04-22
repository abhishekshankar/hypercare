import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { hasOnboardingAck } from "@/lib/onboarding/ack";
import {
  displayNameForProfileWizard,
  getFirstIncompleteStep,
  hasCompletedOnboarding,
  isWizardDataCompleteFromSnapshot,
  loadProfileBundle,
} from "@/lib/onboarding/status";

export default async function OnboardingIndexPage() {
  const session = await requireSession();
  if (await hasCompletedOnboarding(session.userId)) {
    redirect("/app");
  }
  const { user, profile, membership } = await loadProfileBundle(session.userId);
  const disp = displayNameForProfileWizard(user, membership);
  const dataDone = isWizardDataCompleteFromSnapshot(profile, disp);
  const ack = await hasOnboardingAck();
  if (dataDone && !ack) {
    redirect("/onboarding/summary");
  }
  const step = getFirstIncompleteStep(profile, disp) ?? 1;
  redirect(`/onboarding/step/${step}`);
}
