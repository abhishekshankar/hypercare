import "server-only";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";

import { hasOnboardingAck } from "./ack";
import {
  displayNameForProfileWizard,
  getFirstIncompleteStep,
  hasCompletedOnboarding,
  isWizardDataCompleteFromSnapshot,
  loadProfileBundle,
} from "./status";

/** Enforce step order unless the user is editing before summary confirmation. */
export async function assertOnboardingStepAllowed(stepNumber: number): Promise<void> {
  if (stepNumber < 1 || stepNumber > 5) {
    redirect("/onboarding/step/1");
  }
  const session = await requireSession();
  if (await hasCompletedOnboarding(session.userId)) {
    redirect("/app");
  }
  const { user, profile, membership } = await loadProfileBundle(session.userId);
  const disp = displayNameForProfileWizard(user, membership);
  const first = getFirstIncompleteStep(profile, disp);
  const dataDone = isWizardDataCompleteFromSnapshot(profile, disp);
  const ack = await hasOnboardingAck();

  if (first === null && dataDone && !ack) {
    return;
  }
  if (first !== null && stepNumber > first) {
    redirect(`/onboarding/step/${first}`);
  }
}
