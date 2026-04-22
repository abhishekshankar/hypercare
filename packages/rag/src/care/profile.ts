import { eq } from "drizzle-orm";
import {
  careProfile,
  createDbClient,
  getCareProfileForUser,
  MultipleProfilesNotSupportedError,
} from "@hypercare/db";
import { inferInferredStage, type CareProfileStageSnapshot } from "@hypercare/content/stage-rules";

import type { Stage } from "../types.js";

/**
 * Loads the user's `care_profile` and derives a stage label (v0 or v1, TASK-034).
 */
export async function loadStageForUser(
  databaseUrl: string,
  userId: string,
): Promise<Stage | null> {
  const db = createDbClient(databaseUrl);
  let row: {
    stageQuestionsVersion: number;
    stageAnswers: unknown;
    medManagementV1: string | null;
    drivingV1: string | null;
    aloneSafetyV1: string[] | null;
    recognitionV1: string | null;
    bathingDressingV1: string | null;
    wanderingV1: string | null;
    conversationV1: string | null;
    sleepV1: string | null;
  } | null = null;
  try {
    const bundle = await getCareProfileForUser(db, userId);
    if (bundle != null) {
      const p = bundle.profile;
      row = {
        stageQuestionsVersion: p.stageQuestionsVersion,
        stageAnswers: p.stageAnswers,
        medManagementV1: p.medManagementV1,
        drivingV1: p.drivingV1,
        aloneSafetyV1: p.aloneSafetyV1,
        recognitionV1: p.recognitionV1,
        bathingDressingV1: p.bathingDressingV1,
        wanderingV1: p.wanderingV1,
        conversationV1: p.conversationV1,
        sleepV1: p.sleepV1,
      };
    } else {
      const [legacy] = await db
        .select({
          stageQuestionsVersion: careProfile.stageQuestionsVersion,
          stageAnswers: careProfile.stageAnswers,
          medManagementV1: careProfile.medManagementV1,
          drivingV1: careProfile.drivingV1,
          aloneSafetyV1: careProfile.aloneSafetyV1,
          recognitionV1: careProfile.recognitionV1,
          bathingDressingV1: careProfile.bathingDressingV1,
          wanderingV1: careProfile.wanderingV1,
          conversationV1: careProfile.conversationV1,
          sleepV1: careProfile.sleepV1,
        })
        .from(careProfile)
        .where(eq(careProfile.userId, userId))
        .limit(1);
      row = legacy ?? null;
    }
  } catch (e) {
    if (e instanceof MultipleProfilesNotSupportedError) {
      return null;
    }
    throw e;
  }
  if (!row) return null;
  return inferInferredStage({
    stageQuestionsVersion: row.stageQuestionsVersion,
    stageAnswers: row.stageAnswers,
    medManagementV1: row.medManagementV1,
    drivingV1: row.drivingV1,
    aloneSafetyV1: row.aloneSafetyV1,
    recognitionV1: row.recognitionV1,
    bathingDressingV1: row.bathingDressingV1,
    wanderingV1: row.wanderingV1,
    conversationV1: row.conversationV1,
    sleepV1: row.sleepV1,
  } as CareProfileStageSnapshot);
}
