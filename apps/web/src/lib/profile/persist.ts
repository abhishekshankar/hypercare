import "server-only";
import { eq, sql } from "drizzle-orm";
import { careProfile, careProfileChanges, createDbClient, users } from "@hypercare/db";

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
  careProfileUpdate: CareProfileUpdate;
  userDisplayName?: string;
  changes: ChangeRowWithTrigger[];
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
        .where(eq(careProfile.userId, args.userId));
    }
    for (const c of args.changes) {
      const ov = c.oldValue;
      const nv = c.newValue;
      await tx.insert(careProfileChanges).values({
        userId: args.userId,
        section: c.section,
        field: c.field,
        oldValue: ov == null ? null : (ov as object),
        newValue: nv == null ? sql`'null'::jsonb` : (nv as object),
        trigger: c.trigger,
      });
    }
  });
}
