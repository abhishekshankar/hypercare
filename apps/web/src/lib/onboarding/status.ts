import "server-only";
import { eq } from "drizzle-orm";

import { careProfile, createDbClient, users } from "@hypercare/db";

import { serverEnv } from "../env.server";
import { hasOnboardingAck } from "./ack";
import { STAGE_ANSWER_KEYS, type StageAnswersRecord } from "./stage-keys";

export type CareProfileRow = typeof careProfile.$inferSelect;

function countStageAnswers(stageAnswers: unknown): number {
  if (stageAnswers == null || typeof stageAnswers !== "object") {
    return 0;
  }
  const o = stageAnswers as StageAnswersRecord;
  let n = 0;
  for (const k of STAGE_ANSWER_KEYS) {
    const v = o[k];
    if (v === "yes" || v === "no" || v === "unsure") {
      n += 1;
    }
  }
  return n;
}

/**
 * Pure check (testable): wizard data saved through step 5 (`cr_background` set, including "").
 * Ticket minimum: display name, CR name/relationship, ≥5 stage answers.
 */
export function isWizardDataCompleteFromSnapshot(
  profile: CareProfileRow | null,
  displayName: string | null,
): boolean {
  if (displayName == null || displayName.trim() === "") {
    return false;
  }
  if (profile == null) {
    return false;
  }
  if (!profile.crFirstName?.trim() || !profile.crRelationship) {
    return false;
  }
  if (countStageAnswers(profile.stageAnswers) < 5) {
    return false;
  }
  if (profile.crBackground === null) {
    return false;
  }
  return true;
}

/** Pure gate: summary confirmed + wizard data complete (for tests and composition). */
export function hasCompletedOnboardingFromFlags(
  ack: boolean,
  profile: CareProfileRow | null,
  displayName: string | null,
): boolean {
  if (!ack) {
    return false;
  }
  return isWizardDataCompleteFromSnapshot(profile, displayName);
}

/**
 * User may use `/app` and skip `/onboarding` only after summary "Looks right" (ack cookie).
 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const ack = await hasOnboardingAck();
  const { user, profile } = await loadProfileBundle(userId);
  return hasCompletedOnboardingFromFlags(ack, profile, user.displayName);
}

export async function loadProfileBundle(userId: string): Promise<{
  user: { displayName: string | null };
  profile: CareProfileRow | null;
}> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [urow] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const [prow] = await db
    .select()
    .from(careProfile)
    .where(eq(careProfile.userId, userId))
    .limit(1);
  return {
    user: { displayName: urow?.displayName ?? null },
    profile: prow ?? null,
  };
}

/**
 * First step that still needs required data (1–5), or null if the wizard should send the user to summary/app.
 */
export function getFirstIncompleteStep(
  profile: CareProfileRow | null,
  displayName: string | null,
): number | null {
  if (profile == null || !profile.crFirstName?.trim() || !profile.crRelationship) {
    return 1;
  }
  for (const k of STAGE_ANSWER_KEYS) {
    const v = (profile.stageAnswers as StageAnswersRecord | null)?.[k];
    if (v !== "yes" && v !== "no" && v !== "unsure") {
      return 2;
    }
  }
  if (
    !profile.livingSituation ||
    !profile.careNetwork ||
    !profile.caregiverProximity
  ) {
    return 3;
  }
  if (
    displayName == null ||
    displayName.trim() === "" ||
    !profile.caregiverAgeBracket ||
    !profile.caregiverWorkStatus ||
    profile.caregiverState1_5 == null
  ) {
    return 4;
  }
  if (profile.crBackground === null) {
    return 5;
  }
  return null;
}
