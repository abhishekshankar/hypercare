import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { loadProfileBundle, type CareProfileRow } from "@/lib/onboarding/status";
import { diffScalarFields } from "@/lib/profile/change-diff";
import { loadHouseholdMemoryUserIds } from "@/lib/profile/household-memory";
import { applyCareProfileTransaction, type ChangeRowWithTrigger } from "@/lib/profile/persist";
import {
  rowToAboutCrSnapshot,
  rowToAboutYouSnapshot,
  rowToLivingSnapshot,
  rowToStageSnapshot,
  rowToWhatMattersSnapshot,
  step1ToCareProfileUpdate,
  step2V1ToCareProfileUpdate,
  step3ToCareProfileUpdate,
  step4ToCareProfileUpdate,
  step5ToCareProfileUpdate,
} from "@/lib/profile/row-snapshots";
import { careProfileToStageSnapshot } from "@/lib/onboarding/care-profile-stage-snapshot";
import { inferInferredStage } from "@/lib/onboarding/stage";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
} from "@/lib/onboarding/schemas";

export const dynamic = "force-dynamic";

const SECTIONS = [
  "about_cr",
  "stage",
  "living",
  "about_you",
  "what_matters",
] as const;

type Section = (typeof SECTIONS)[number];

function isSection(s: string): s is Section {
  return (SECTIONS as readonly string[]).includes(s);
}

type OkBody = {
  ok: true;
  changedFields: string[];
  inferredStage?: "early" | "middle" | "late" | "unknown" | null;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ section: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { section: raw } = await context.params;
  if (!isSection(raw)) {
    return NextResponse.json({ error: "invalid_section" }, { status: 400 });
  }
  const { profile, user } = await loadProfileBundle(session.userId);
  if (profile == null) {
    return NextResponse.json({ error: "no_profile" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (raw === "about_cr") {
    return handleAboutCr(session.userId, profile, body);
  }
  if (raw === "stage") {
    return handleStage(session.userId, profile, body);
  }
  if (raw === "living") {
    return handleLiving(session.userId, profile, body);
  }
  if (raw === "about_you") {
    return handleAboutYou(session.userId, profile, user.displayName, body);
  }
  return handleWhatMatters(session.userId, profile, body);
}

function handleAboutCr(userId: string, profile: CareProfileRow, body: unknown) {
  const parsed = step1Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const before = rowToAboutCrSnapshot(profile);
  const after: Record<string, unknown> = {
    cr_first_name: d.cr_first_name,
    cr_age: d.cr_age,
    cr_relationship: d.cr_relationship,
    cr_diagnosis: d.cr_diagnosis,
    cr_diagnosis_year: d.cr_diagnosis_year,
  };
  const part = diffScalarFields("about_cr", before, after);
  if (part.length === 0) {
    return NextResponse.json({ ok: true, changedFields: [] } satisfies OkBody);
  }
  const changes: ChangeRowWithTrigger[] = part.map((p) => ({ ...p, trigger: "user_edit" as const }));
  return persistAndJson(userId, profile, step1ToCareProfileUpdate(d), changes);
}

function handleStage(userId: string, profile: CareProfileRow, body: unknown) {
  const parsed = step2Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const before = rowToStageSnapshot(profile);
  const after: Record<string, unknown> = { ...d };
  const part = diffScalarFields("stage", before, after);
  const nextSnap = {
    ...careProfileToStageSnapshot(profile),
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
  const nextInferred = inferInferredStage(nextSnap);
  if (part.length === 0 && profile.inferredStage === (nextInferred as string | null)) {
    return NextResponse.json({ ok: true, changedFields: [] } satisfies OkBody);
  }
  const changes: ChangeRowWithTrigger[] = part.map((p) => ({ ...p, trigger: "user_edit" as const }));
  const prevInferred = profile.inferredStage;
  if (prevInferred !== (nextInferred as string | null)) {
    changes.push({
      section: "stage",
      field: "inferred_stage",
      oldValue: prevInferred,
      newValue: nextInferred,
      trigger: "system_inferred",
    });
  }
  const up = step2V1ToCareProfileUpdate(d, nextInferred);
  const careProfileUpdate = up;
  const fieldNames = changes.map((c) => c.field);
  return persistAndJson(
    userId,
    profile,
    careProfileUpdate,
    changes,
    { inferredStage: nextInferred as OkBody["inferredStage"] },
    fieldNames,
  );
}

function handleLiving(userId: string, profile: CareProfileRow, body: unknown) {
  const parsed = step3Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const before = rowToLivingSnapshot(profile);
  const after: Record<string, unknown> = {
    living_situation: d.living_situation,
    care_network: d.care_network,
    care_hours_per_week: d.care_hours_per_week,
    caregiver_proximity: d.caregiver_proximity,
  };
  const part = diffScalarFields("living", before, after);
  if (part.length === 0) {
    return NextResponse.json({ ok: true, changedFields: [] } satisfies OkBody);
  }
  const changes: ChangeRowWithTrigger[] = part.map((p) => ({ ...p, trigger: "user_edit" as const }));
  return persistAndJson(userId, profile, step3ToCareProfileUpdate(d), changes);
}

async function handleAboutYou(
  userId: string,
  profile: CareProfileRow,
  displayName: string | null,
  body: unknown,
) {
  const parsed = step4Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const before = rowToAboutYouSnapshot(profile, displayName);
  const after: Record<string, unknown> = {
    display_name: d.display_name,
    caregiver_age_bracket: d.caregiver_age_bracket,
    caregiver_work_status: d.caregiver_work_status,
    caregiver_state_1_5: d.caregiver_state_1_5,
    hardest_thing: d.hardest_thing,
  };
  const part = diffScalarFields("about_you", before, after);
  if (part.length === 0) {
    return NextResponse.json({ ok: true, changedFields: [] } satisfies OkBody);
  }
  const changes: ChangeRowWithTrigger[] = part.map((p) => ({ ...p, trigger: "user_edit" as const }));
  const memIds = await loadHouseholdMemoryUserIds(profile.id);
  await applyCareProfileTransaction({
    userId,
    careProfileId: profile.id,
    userDisplayName: d.display_name,
    careProfileUpdate: step4ToCareProfileUpdate(d),
    changes,
    invalidateMemoryUserIds: memIds.length > 0 ? memIds : [userId],
  });
  return NextResponse.json({
    ok: true,
    changedFields: part.map((p) => p.field),
  } satisfies OkBody);
}

function handleWhatMatters(userId: string, profile: CareProfileRow, body: unknown) {
  const parsed = step5Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const before = rowToWhatMattersSnapshot(profile);
  const after: Record<string, unknown> = {
    cr_background: d.cr_background,
    cr_joy: d.cr_joy,
    cr_personality_notes: d.cr_personality_notes,
  };
  const part = diffScalarFields("what_matters", before, after);
  if (part.length === 0) {
    return NextResponse.json({ ok: true, changedFields: [] } satisfies OkBody);
  }
  const changes: ChangeRowWithTrigger[] = part.map((p) => ({ ...p, trigger: "user_edit" as const }));
  return persistAndJson(userId, profile, step5ToCareProfileUpdate(d), changes);
}

function persistAndJson(
  userId: string,
  profile: CareProfileRow,
  careProfileUpdate: Record<string, unknown>,
  changes: ChangeRowWithTrigger[],
  extra?: { inferredStage: OkBody["inferredStage"] },
  fieldNamesOverride?: string[],
) {
  return (async () => {
    const memIds = await loadHouseholdMemoryUserIds(profile.id);
    await applyCareProfileTransaction({
      userId,
      careProfileId: profile.id,
      careProfileUpdate: careProfileUpdate as never,
      changes,
      invalidateMemoryUserIds: memIds.length > 0 ? memIds : [userId],
    });
  })().then(() => {
    const payload: OkBody = {
      ok: true,
      changedFields: fieldNamesOverride ?? changes.map((c) => c.field),
    };
    if (extra != null && extra.inferredStage !== undefined) {
      payload.inferredStage = extra.inferredStage;
    }
    return NextResponse.json(payload);
  });
}
