import "server-only";
import { eq, sql } from "drizzle-orm";
import { careProfile, careProfileChanges, createDbClient, users } from "@alongside/db";

import { invalidateConversationMemoryForUserIds } from "@/lib/conversation/invalidate-memory";
import { serverEnv } from "../env.server";
import type { ProfileChangePart } from "./change-diff";

export type ChangeRowWithTrigger = ProfileChangePart & {
  trigger: "user_edit" | "evolved_state_flow" | "system_inferred";
};

type CareProfileUpdate = Partial<{
  crFirstName: string;
  crAge: number | null;
  crRelationship: string;
  crDiagnosis: string | null;
  crDiagnosisYear: number | null;
  stageQuestionsVersion: number;
  medManagementV1: string | null;
  drivingV1: string | null;
  aloneSafetyV1: string[] | null;
  recognitionV1: string | null;
  bathingDressingV1: string | null;
  wanderingV1: string | null;
  conversationV1: string | null;
  sleepV1: string | null;
  stageAnswers: unknown;
  inferredStage: string | null;
  livingSituation: string | null;
  careNetwork: string | null;
  careHoursPerWeek: number | null;
  caregiverProximity: string | null;
  caregiverAgeBracket: string | null;
  caregiverWorkStatus: string | null;
  caregiverState1_5: number | null;
  hardestThing: string | null;
  crBackground: string | null;
  crJoy: string | null;
  crPersonalityNotes: string | null;
}>;

export async function applyCareProfileTransaction(args: {
  userId: string;
  /** Shared profile row id (TASK-038); updates target this id, not `care_profile.user_id`. */
  careProfileId: string;
  careProfileUpdate: CareProfileUpdate;
  userDisplayName?: string;
  changes: ChangeRowWithTrigger[];
  /** When set, invalidate memory for every caregiver on the shared profile. */
  invalidateMemoryUserIds?: string[];
}): Promise<void> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  await db.transaction(async (tx) => {
    if (args.userDisplayName != null) {
      await tx
        .update(users)
        .set({ displayName: args.userDisplayName, updatedAt: new Date() })
        .where(eq(users.id, args.userId));
    }
    if (Object.keys(args.careProfileUpdate).length > 0) {
      await tx
        .update(careProfile)
        .set({ ...args.careProfileUpdate, updatedAt: new Date() })
        .where(eq(careProfile.id, args.careProfileId));
    }
    for (const c of args.changes) {
      const ov = c.oldValue;
      const nv = c.newValue;
      await tx.insert(careProfileChanges).values({
        userId: args.userId,
        changedBy: args.userId,
        section: c.section,
        field: c.field,
        oldValue: ov == null ? null : (ov as object),
        newValue: nv == null ? sql`'null'::jsonb` : (nv as object),
        trigger: c.trigger,
      });
    }
  });
  if (args.changes.length > 0) {
    const ids = args.invalidateMemoryUserIds ?? [args.userId];
    void invalidateConversationMemoryForUserIds(ids).catch((e) => {
      console.warn("invalidateConversationMemoryForUserIds", e);
    });
  }
}
