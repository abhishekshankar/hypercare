"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import {
  careProfile,
  createDbClient,
  ensureOwnerMembershipRow,
  getCareProfileForUser,
  users,
} from "@alongside/db";

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
import { careProfileToStageSnapshot } from "@/lib/onboarding/care-profile-stage-snapshot";
import { inferInferredStage } from "@/lib/onboarding/stage";
import { step2V1ToCareProfileUpdate } from "@/lib/profile/row-snapshots";
import type { OnboardingActionState } from "@/lib/onboarding/action-state";
import {
  displayNameForProfileWizard,
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
  const existingBundle = await getCareProfileForUser(db, session.userId);
  if (existingBundle?.membership.role === "co_caregiver") {
    redirect("/app");
  }
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
  const [cp] = await db
    .select({ id: careProfile.id })
    .from(careProfile)
    .where(eq(careProfile.userId, session.userId))
    .limit(1);
  if (cp != null) {
    await ensureOwnerMembershipRow(db, { careProfileId: cp.id, userId: session.userId });
  }
  redirect("/onboarding/step/2");
}

export async function submitOnboardingStep2(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const session = await requireSession();
  const raw = {
    med_management_v1: formData.get("med_management_v1"),
    driving_v1: formData.get("driving_v1"),
    alone_safety_v1: formData.getAll("alone_safety_v1"),
    recognition_v1: formData.get("recognition_v1"),
    bathing_dressing_v1: formData.get("bathing_dressing_v1"),
    wandering_v1: formData.get("wandering_v1"),
    conversation_v1: formData.get("conversation_v1"),
    sleep_v1: formData.get("sleep_v1"),
  };
  const parsed = step2Schema.safeParse(raw);
  if (!parsed.success) {
    return fail(flattenFieldErrors(parsed.error));
  }
  const d = parsed.data;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const { profile: existing } = await loadProfileBundle(session.userId);
  if (existing == null) {
    redirect("/onboarding/step/1");
  }
  const nextSnap = {
    ...careProfileToStageSnapshot(existing),
    medManagementV1: d.med_management_v1,
    drivingV1: d.driving_v1,
    aloneSafetyV1: d.alone_safety_v1,
    recognitionV1: d.recognition_v1,
    bathingDressingV1: d.bathing_dressing_v1,
    wanderingV1: d.wandering_v1,
    conversationV1: d.conversation_v1,
    sleepV1: d.sleep_v1,
    stageQuestionsVersion: 1,
    stageAnswers: {} as Record<string, never>,
  };
  const inferred = inferInferredStage(nextSnap);
  const up = step2V1ToCareProfileUpdate(d, inferred);
  await db
    .update(careProfile)
    .set({
      ...up,
      updatedAt: new Date(),
    })
    .where(eq(careProfile.id, existing.id));
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
  const { profile: row } = await loadProfileBundle(session.userId);
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
    .where(eq(careProfile.id, row.id));
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
  const { profile: row } = await loadProfileBundle(session.userId);
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
    .where(eq(careProfile.id, row.id));
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
  const { profile: row } = await loadProfileBundle(session.userId);
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
    .where(eq(careProfile.id, row.id));
  redirect("/onboarding/summary");
}

export async function confirmOnboardingSummary(): Promise<void> {
  const session = await requireSession();
  const { user, profile, membership } = await loadProfileBundle(session.userId);
  const disp = displayNameForProfileWizard(user, membership);
  if (!isWizardDataCompleteFromSnapshot(profile, disp)) {
    const step = getFirstIncompleteStep(profile, disp) ?? 1;
    redirect(`/onboarding/step/${step}`);
  }
  await setOnboardingAck();
  redirect("/app");
}
