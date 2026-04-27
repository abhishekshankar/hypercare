#!/usr/bin/env node
/**
 * TASK-034: migrate legacy `stage_answers` (v0) to v1 ordinals + recompute `inferred_stage`.
 * Usage: `pnpm --filter @alongside/content migrate:stage-v1` (dry-run) or `--commit`.
 */
import { eq } from "drizzle-orm";

import {
  careProfile,
  createDbClient,
  requireDatabaseUrl,
} from "@alongside/db";
import {
  inferInferredStage,
  mapStageAnswersV0ToV1,
  type CareProfileStageSnapshot,
  type StageAnswersRecord,
} from "../stage-rules/index.js";

const commit = process.argv.includes("--commit");

async function main() {
  const url = requireDatabaseUrl();
  const db = createDbClient(url);
  const rows = await db.select().from(careProfile);

  let updated = 0;
  let stageFlips = 0;
  const dist = { early: 0, middle: 0, late: 0, unknown: 0 };

  for (const row of rows) {
    if ((row.stageQuestionsVersion ?? 0) >= 1) {
      continue;
    }
    const v0 = (row.stageAnswers ?? {}) as StageAnswersRecord;
    const v1 = mapStageAnswersV0ToV1(v0);
    const nextSnap = {
      stageQuestionsVersion: 1,
      stageAnswers: {},
      medManagementV1: v1.medManagementV1,
      drivingV1: v1.drivingV1,
      aloneSafetyV1: v1.aloneSafetyV1,
      recognitionV1: v1.recognitionV1,
      bathingDressingV1: v1.bathingDressingV1,
      wanderingV1: v1.wanderingV1,
      conversationV1: v1.conversationV1,
      sleepV1: v1.sleepV1,
    } as CareProfileStageSnapshot;
    const next = inferInferredStage(nextSnap);
    const prev = row.inferredStage;
    if (prev !== next && prev != null && next != null) {
      stageFlips += 1;
    }
    if (next === "early") dist.early += 1;
    else if (next === "middle") dist.middle += 1;
    else if (next === "late") dist.late += 1;
    else dist.unknown += 1;

    if (commit) {
      await db
        .update(careProfile)
        .set({
          stageQuestionsVersion: 1,
          stageAnswers: {},
          medManagementV1: v1.medManagementV1,
          drivingV1: v1.drivingV1,
          aloneSafetyV1: v1.aloneSafetyV1,
          recognitionV1: v1.recognitionV1,
          bathingDressingV1: v1.bathingDressingV1,
          wanderingV1: v1.wanderingV1,
          conversationV1: v1.conversationV1,
          sleepV1: v1.sleepV1,
          inferredStage: next,
          updatedAt: new Date(),
        })
        .where(eq(careProfile.id, row.id));
    }
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        dryRun: !commit,
        rowsConsidered: updated,
        stageFlipsVsPriorInferred: stageFlips,
        nextStageDistribution: dist,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
