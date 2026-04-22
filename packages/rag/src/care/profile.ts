import { eq } from "drizzle-orm";
import { careProfile, createDbClient } from "@hypercare/db";

import type { Stage } from "../types.js";
import { inferStage, type StageAnswersRecord } from "./stage.js";

/**
 * Loads the user's `care_profile.stage_answers` and derives a stage label.
 *
 * Returns `null` if the profile is missing or has fewer than 5 answers
 * (matches `inferStage`'s contract). Callers treat `null` as "no stage filter".
 *
 * Reads from the `@hypercare/db` client. We intentionally do not call into
 * `apps/web/src/lib/onboarding/status.ts` because that module is `server-only`
 * Next.js code; this package is consumed by both the web app and CLIs.
 */
export async function loadStageForUser(
  databaseUrl: string,
  userId: string,
): Promise<Stage | null> {
  const db = createDbClient(databaseUrl);
  const [row] = await db
    .select({ stageAnswers: careProfile.stageAnswers })
    .from(careProfile)
    .where(eq(careProfile.userId, userId))
    .limit(1);
  if (!row) return null;
  const answers = (row.stageAnswers ?? {}) as StageAnswersRecord;
  return inferStage(answers);
}
