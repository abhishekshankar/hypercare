import { eq } from "drizzle-orm";
import {
  careProfile,
  createDbClient,
  getCareProfileForUser,
  MultipleProfilesNotSupportedError,
} from "@alongside/db";
import { inferInferredStage, type CareProfileStageSnapshot } from "@alongside/content/stage-rules";

import type { Stage } from "../types.js";

/** Axes used for branch-chunk retrieval reranking (SURFACES-06). */
export type CareRetrievalAxes = {
  stage: Stage | null;
  relationship: string | null;
  livingSituation: string | null;
};

/**
 * Loads the user's `care_profile` and derives a stage label (v0 or v1, TASK-034).
 */
export async function loadStageForUser(
  databaseUrl: string,
  userId: string,
): Promise<Stage | null> {
  const axes = await loadCareRetrievalAxesForUser(databaseUrl, userId);
  return axes.stage;
}

/**
 * Stage plus relationship / living situation for branch-aware retrieval.
 */
export async function loadCareRetrievalAxesForUser(
  databaseUrl: string,
  userId: string,
): Promise<CareRetrievalAxes> {
  const db = createDbClient(databaseUrl);
  let row: {
    inferredStage: string | null;
    crRelationship: string;
    livingSituation: string | null;
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
        inferredStage: p.inferredStage,
        crRelationship: p.crRelationship,
        livingSituation: p.livingSituation,
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
          inferredStage: careProfile.inferredStage,
          crRelationship: careProfile.crRelationship,
          livingSituation: careProfile.livingSituation,
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
      return { stage: null, relationship: null, livingSituation: null };
    }
    throw e;
  }
  if (!row) return { stage: null, relationship: null, livingSituation: null };

  let stage: Stage | null = null;
  const inferred = row.inferredStage;
  if (inferred === "early" || inferred === "middle" || inferred === "late") {
    stage = inferred;
  } else {
    stage = inferInferredStage({
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

  return {
    stage,
    relationship: row.crRelationship,
    livingSituation: row.livingSituation?.trim() || null,
  };
}
