"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { careProfile, createDbClient, users } from "@hypercare/db";

import { requireSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import {
  flattenFieldErrors,
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
} from "@/lib/onboarding/schemas";
import { setOnboardingAck } from "@/lib/onboarding/ack";
import { inferStage } from "@/lib/onboarding/stage";
import type { StageAnswersRecord } from "@/lib/onboarding/stage-keys";
import type { OnboardingActionState } from "@/lib/onboarding/action-state";
import {
  getFirstIncompleteStep,
  isWizardDataCompleteFromSnapshot,
  loadProfileBundle,
} from "@/lib/onboarding/status";

function fail(err: Record<string, string>): OnboardingActionState {
  const keys = Object.keys(err);
  return { ok: false, errors: err, errorCount: keys.length };
}

export async function submitOnboardingStep1(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const session = await requireSession();
  const raw = {
    cr_first_name: formData.get("cr_first_name"),
    cr_age: formData.get("cr_age"),
    cr_relationship: formData.get("cr_relationship"),
    cr_diagnosis: formData.get("cr_diagnosis"),
    cr_diagnosis_year: formData.get("cr_diagnosis_year"),
  };
  const parsed = step1Schema.safeParse(raw);
  if (!parsed.success) {
    return fail(flattenFieldErrors(parsed.error));
  }
  const d = parsed.data;
  const db = createDbClient(serverEnv.DATABASE_URL);
  await db
    .insert(careProfile)
    .values({
      userId: session.userId,
      crFirstName: d.cr_first_name,
      crAge: d.cr_age ?? null,
      crRelationship: d.cr_relationship,
      crDiagnosis: d.cr_diagnosis,
      crDiagnosisYear: d.cr_diagnosis_year ?? null,
    })
    .onConflictDoUpdate({
      target: careProfile.userId,
      set: {
        crFirstName: d.cr_first_name,
        crAge: d.cr_age ?? null,
        crRelationship: d.cr_relationship,
        crDiagnosis: d.cr_diagnosis,
        crDiagnosisYear: d.cr_diagnosis_year ?? null,
        updatedAt: new Date(),
      },
    });
  redirect("/onboarding/step/2");
}

export async function submitOnboardingStep2(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const session = await requireSession();
  const raw: Record<string, unknown> = {};
  for (const k of [
    "manages_meds",
    "drives",
    "left_alone",
    "recognizes_you",
    "bathes_alone",
    "wandering_incidents",
    "conversations",
    "sleeps_through_night",
  ] as const) {
    raw[k] = formData.get(k);
  }
  const parsed = step2Schema.safeParse(raw);
  if (!parsed.success) {
    return fail(flattenFieldErrors(parsed.error));
  }
  const stageAnswers = parsed.data as StageAnswersRecord;
  const inferred = inferStage(stageAnswers);
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [existing] = await db
    .select({ id: careProfile.id })
    .from(careProfile)
    .where(eq(careProfile.userId, session.userId))
    .limit(1);
  if (existing == null) {
    redirect("/onboarding/step/1");
  }
  await db
    .update(careProfile)
    .set({
      stageAnswers,
      inferredStage: inferred,
      updatedAt: new Date(),
    })
    .where(eq(careProfile.userId, session.userId));
  redirect("/onboarding/step/3");
}

export async function submitOnboardingStep3(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const session = await requireSession();
  const raw = {
    living_situation: formData.get("living_situation"),
    care_network: formData.get("care_network"),
    care_hours_per_week: formData.get("care_hours_per_week"),
    caregiver_proximity: formData.get("caregiver_proximity"),
  };
  const parsed = step3Schema.safeParse(raw);
  if (!parsed.success) {
    return fail(flattenFieldErrors(parsed.error));
  }
  const d = parsed.data;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db
    .select({ id: careProfile.id })
    .from(careProfile)
    .where(eq(careProfile.userId, session.userId))
    .limit(1);
  if (row == null) {
    redirect("/onboarding/step/1");
  }
  await db
    .update(careProfile)
    .set({
      livingSituation: d.living_situation,
      careNetwork: d.care_network,
      careHoursPerWeek: d.care_hours_per_week ?? null,
      caregiverProximity: d.caregiver_proximity,
      updatedAt: new Date(),
    })
    .where(eq(careProfile.userId, session.userId));
  redirect("/onboarding/step/4");
}

export async function submitOnboardingStep4(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const session = await requireSession();
  const raw = {
    display_name: formData.get("display_name"),
    caregiver_age_bracket: formData.get("caregiver_age_bracket"),
    caregiver_work_status: formData.get("caregiver_work_status"),
    caregiver_state_1_5: formData.get("caregiver_state_1_5"),
    hardest_thing: formData.get("hardest_thing"),
  };
  const parsed = step4Schema.safeParse(raw);
  if (!parsed.success) {
    return fail(flattenFieldErrors(parsed.error));
  }
  const d = parsed.data;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db
    .select({ id: careProfile.id })
    .from(careProfile)
    .where(eq(careProfile.userId, session.userId))
    .limit(1);
  if (row == null) {
    redirect("/onboarding/step/1");
  }
  await db
    .update(users)
    .set({ displayName: d.display_name, updatedAt: new Date() })
    .where(eq(users.id, session.userId));
  await db
    .update(careProfile)
    .set({
      caregiverAgeBracket: d.caregiver_age_bracket,
      caregiverWorkStatus: d.caregiver_work_status,
      caregiverState1_5: d.caregiver_state_1_5,
      hardestThing: d.hardest_thing,
      updatedAt: new Date(),
    })
    .where(eq(careProfile.userId, session.userId));
  redirect("/onboarding/step/5");
}

export async function submitOnboardingStep5(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const session = await requireSession();
  const raw = {
    cr_background: formData.get("cr_background") ?? "",
    cr_joy: formData.get("cr_joy") ?? "",
    cr_personality_notes: formData.get("cr_personality_notes") ?? "",
  };
  const parsed = step5Schema.safeParse(raw);
  if (!parsed.success) {
    return fail(flattenFieldErrors(parsed.error));
  }
  const d = parsed.data;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db
    .select({ id: careProfile.id })
    .from(careProfile)
    .where(eq(careProfile.userId, session.userId))
    .limit(1);
  if (row == null) {
    redirect("/onboarding/step/1");
  }
  await db
    .update(careProfile)
    .set({
      crBackground: d.cr_background,
      crJoy: d.cr_joy,
      crPersonalityNotes: d.cr_personality_notes,
      updatedAt: new Date(),
    })
    .where(eq(careProfile.userId, session.userId));
  redirect("/onboarding/summary");
}

export async function confirmOnboardingSummary(): Promise<void> {
  const session = await requireSession();
  const { user, profile } = await loadProfileBundle(session.userId);
  if (!isWizardDataCompleteFromSnapshot(profile, user.displayName)) {
    const step = getFirstIncompleteStep(profile, user.displayName) ?? 1;
    redirect(`/onboarding/step/${step}`);
  }
  await setOnboardingAck();
  redirect("/app");
}
