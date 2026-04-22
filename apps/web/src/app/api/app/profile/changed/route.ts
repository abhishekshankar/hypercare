import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { loadProfileBundle } from "@/lib/onboarding/status";
import { diffScalarFields, diffStageAnswerKeys } from "@/lib/profile/change-diff";
import { applyCareProfileTransaction, type ChangeRowWithTrigger } from "@/lib/profile/persist";
import {
  rowToAboutYouSnapshot,
  rowToLivingSnapshot,
  rowToStageSnapshot,
  step2ToStageAnswers,
  step3ToCareProfileUpdate,
  step4ToCareProfileUpdate,
} from "@/lib/profile/row-snapshots";
import { inferStage } from "@/lib/onboarding/stage";
import { step2Schema, step3Schema, step4Schema } from "@/lib/onboarding/schemas";

export const dynamic = "force-dynamic";

const changedPostSchema = z.object({
  stage: step2Schema.optional(),
  living: step3Schema.optional(),
  about_you: step4Schema.optional(),
  anything_else: z.string().max(500).optional().nullable(),
});

type Ok = {
  ok: true;
  changedFields: string[];
  inferredStage?: "early" | "middle" | "late" | "unknown" | null;
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  const parsed = changedPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const hasAny =
    data.stage != null ||
    data.living != null ||
    data.about_you != null ||
    (data.anything_else != null && data.anything_else.trim() !== "");
  if (!hasAny) {
    return NextResponse.json({ ok: true, changedFields: [] } satisfies Ok);
  }

  const allChanges: ChangeRowWithTrigger[] = [];
  const careProfileUpdate: Record<string, unknown> = {};
  const changedSet = new Set<string>();
  let userDisplayName: string | undefined;
  let evolvedInferred: ReturnType<typeof inferStage> | undefined;

  if (data.stage != null) {
    const d = data.stage;
    const stageAnswers = step2ToStageAnswers(d);
    const before = rowToStageSnapshot(profile);
    const after: Record<string, unknown> = { ...d };
    const part = diffStageAnswerKeys(before, after).map(
      (p): ChangeRowWithTrigger => ({ ...p, trigger: "evolved_state_flow" }),
    );
    for (const p of part) {
      allChanges.push(p);
      changedSet.add(p.field);
    }
    const prev = profile.inferredStage;
    const next = inferStage(stageAnswers);
    if (prev !== (next as string | null)) {
      allChanges.push({
        section: "stage",
        field: "inferred_stage",
        oldValue: prev,
        newValue: next,
        trigger: "system_inferred",
      });
      changedSet.add("inferred_stage");
    }
    careProfileUpdate.stageAnswers = stageAnswers;
    careProfileUpdate.inferredStage = next;
    evolvedInferred = next;
  }

  if (data.living != null) {
    const d = data.living;
    const before = rowToLivingSnapshot(profile);
    const after: Record<string, unknown> = {
      living_situation: d.living_situation,
      care_network: d.care_network,
      care_hours_per_week: d.care_hours_per_week,
      caregiver_proximity: d.caregiver_proximity,
    };
    const part = diffScalarFields("living", before, after).map(
      (p): ChangeRowWithTrigger => ({ ...p, trigger: "evolved_state_flow" }),
    );
    for (const p of part) {
      allChanges.push(p);
      changedSet.add(p.field);
    }
    Object.assign(careProfileUpdate, step3ToCareProfileUpdate(d));
  }

  if (data.about_you != null) {
    const d = data.about_you;
    const before = rowToAboutYouSnapshot(profile, user.displayName);
    const after: Record<string, unknown> = {
      display_name: d.display_name,
      caregiver_age_bracket: d.caregiver_age_bracket,
      caregiver_work_status: d.caregiver_work_status,
      caregiver_state_1_5: d.caregiver_state_1_5,
      hardest_thing: d.hardest_thing,
    };
    const part = diffScalarFields("about_you", before, after).map(
      (p): ChangeRowWithTrigger => ({ ...p, trigger: "evolved_state_flow" }),
    );
    for (const p of part) {
      allChanges.push(p);
      changedSet.add(p.field);
    }
    userDisplayName = d.display_name;
    Object.assign(careProfileUpdate, step4ToCareProfileUpdate(d));
  }

  if (data.anything_else != null && data.anything_else.trim() !== "") {
    const add = data.anything_else.trim();
    const oldNotes = profile.crPersonalityNotes ?? "";
    const newNotes = oldNotes ? `${oldNotes}\n\n${add}` : add;
    if (oldNotes !== newNotes) {
      allChanges.push({
        section: "what_matters",
        field: "cr_personality_notes",
        oldValue: oldNotes.length ? oldNotes : null,
        newValue: newNotes,
        trigger: "evolved_state_flow",
      });
      changedSet.add("cr_personality_notes");
    }
    careProfileUpdate.crPersonalityNotes = newNotes;
  }

  if (allChanges.length === 0) {
    return NextResponse.json({ ok: true, changedFields: [] } satisfies Ok);
  }

  await applyCareProfileTransaction({
    userId: session.userId,
    ...(userDisplayName !== undefined ? { userDisplayName } : {}),
    careProfileUpdate: careProfileUpdate as never,
    changes: allChanges,
  });

  const resBody: Ok = { ok: true, changedFields: [...changedSet] };
  if (evolvedInferred !== undefined) {
    resBody.inferredStage = evolvedInferred;
  }
  return NextResponse.json(resBody);
}
