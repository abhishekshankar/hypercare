import "server-only";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";

import { hasOnboardingAck } from "./ack";
import {
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
  const { user, profile } = await loadProfileBundle(session.userId);
  const first = getFirstIncompleteStep(profile, user.displayName);
  const dataDone = isWizardDataCompleteFromSnapshot(profile, user.displayName);
  const ack = await hasOnboardingAck();

  if (first === null && dataDone && !ack) {
    return;
  }
  if (first !== null && stepNumber > first) {
    redirect(`/onboarding/step/${first}`);
  }
}
