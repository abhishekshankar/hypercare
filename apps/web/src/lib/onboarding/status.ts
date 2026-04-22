import "server-only";
import { eq } from "drizzle-orm";

import {
  careProfile,
  careProfileMembers,
  createDbClient,
  getCareProfileForUser,
  MultipleProfilesNotSupportedError,
  users,
} from "@hypercare/db";

import { serverEnv } from "../env.server";
import { hasOnboardingAck } from "./ack";
import { countStageV1Answered, isStageV1Answered, type StageV1Answers } from "@hypercare/content/stage-rules";

import { STAGE_ANSWER_KEYS, type StageAnswersRecord } from "./stage-keys";

export type CareProfileRow = typeof careProfile.$inferSelect;
export type CareProfileMembershipRow = typeof careProfileMembers.$inferSelect;

/** Display name used for onboarding completeness (co-caregivers may fall back to email local-part). */
export function displayNameForProfileWizard(
  user: { displayName: string | null; email: string | null },
  membership: CareProfileMembershipRow | null,
): string | null {
  if (membership?.role === "co_caregiver") {
    return user.displayName?.trim() || user.email?.split("@")[0] || null;
  }
  return user.displayName;
}

function countStageAnswers(profile: CareProfileRow | null): number {
  if (profile == null) {
    return 0;
  }
  if ((profile.stageQuestionsVersion ?? 0) >= 1) {
    return countStageV1Answered({
      medManagementV1: profile.medManagementV1,
      drivingV1: profile.drivingV1,
      aloneSafetyV1: profile.aloneSafetyV1,
      recognitionV1: profile.recognitionV1,
      bathingDressingV1: profile.bathingDressingV1,
      wanderingV1: profile.wanderingV1,
      conversationV1: profile.conversationV1,
      sleepV1: profile.sleepV1,
    } as StageV1Answers);
  }
  if (profile.stageAnswers == null || typeof profile.stageAnswers !== "object") {
    return 0;
  }
  const o = profile.stageAnswers as StageAnswersRecord;
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
  if (countStageAnswers(profile) < 5) {
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
  const { user, profile, membership } = await loadProfileBundle(userId);
  if (profile == null) {
    return false;
  }
  if (membership?.role === "co_caregiver") {
    const disp = user.displayName?.trim() || user.email?.split("@")[0] || null;
    return isWizardDataCompleteFromSnapshot(profile, disp);
  }
  return hasCompletedOnboardingFromFlags(ack, profile, user.displayName);
}

export async function loadProfileBundle(userId: string): Promise<{
  user: { displayName: string | null; email: string | null };
  profile: CareProfileRow | null;
  /** Present after TASK-038 migration backfill; null means legacy owner row only. */
  membership: CareProfileMembershipRow | null;
}> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [urow] = await db
    .select({ displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = { displayName: urow?.displayName ?? null, email: urow?.email ?? null };

  let bundle: Awaited<ReturnType<typeof getCareProfileForUser>>;
  try {
    bundle = await getCareProfileForUser(db, userId);
  } catch (e) {
    if (e instanceof MultipleProfilesNotSupportedError) {
      throw e;
    }
    throw e;
  }
  if (bundle != null) {
    return { user, profile: bundle.profile, membership: bundle.membership };
  }

  const [owned] = await db.select().from(careProfile).where(eq(careProfile.userId, userId)).limit(1);
  if (owned != null) {
    return { user, profile: owned, membership: null };
  }
  return { user, profile: null, membership: null };
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
  if ((profile.stageQuestionsVersion ?? 0) >= 1) {
    const v1 = {
      medManagementV1: profile.medManagementV1,
      drivingV1: profile.drivingV1,
      aloneSafetyV1: profile.aloneSafetyV1,
      recognitionV1: profile.recognitionV1,
      bathingDressingV1: profile.bathingDressingV1,
      wanderingV1: profile.wanderingV1,
      conversationV1: profile.conversationV1,
      sleepV1: profile.sleepV1,
    } as StageV1Answers;
    if (!isStageV1Answered(v1)) {
      return 2;
    }
  } else {
    for (const k of STAGE_ANSWER_KEYS) {
      const v = (profile.stageAnswers as StageAnswersRecord | null)?.[k];
      if (v !== "yes" && v !== "no" && v !== "unsure") {
        return 2;
      }
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
