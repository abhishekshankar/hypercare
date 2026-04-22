import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { hasOnboardingAck } from "@/lib/onboarding/ack";
import {
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
  const { user, profile } = await loadProfileBundle(session.userId);
  const dataDone = isWizardDataCompleteFromSnapshot(profile, user.displayName);
  const ack = await hasOnboardingAck();
  if (dataDone && !ack) {
    redirect("/onboarding/summary");
  }
  const step = getFirstIncompleteStep(profile, user.displayName) ?? 1;
  redirect(`/onboarding/step/${step}`);
}
