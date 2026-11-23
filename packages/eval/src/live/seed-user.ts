/**
 * Seed a recognizable, ephemeral `users` (+ optional `care_profile`) row for a
 * live eval run, and tear it down unconditionally on exit.
 *
 * Why a real row?
 * The RAG pipeline's `loadStageForUser` and `safety.persist` both write/read
 * `users.id` (uuid, FK). Synthetic string ids (e.g. `eval-safety:foo`) trip
 * the uuid type check at layer 1.5 of `runPipeline` and surface as opaque
 * `internal_error`s in the report — the eval then measures "the pipeline
 * crashed" instead of "the pipeline performed poorly." See ADR 0011 and
 * `tasks/TASK-012-eval-harness.md` (preflight section).
 *
 * Recognizable marker: every seeded row uses
 *   `email = eval+<runner>+<iso-utc>@alongside.invalid`
 *   `cognito_sub = eval-<runner>-<iso-utc>-<rand>`
 * so a human running `select email from users` later can tell at a glance
 * "that's eval test data, not a real caregiver."
 *
 * Teardown is unconditional (try/finally in the runner). A crashed eval must
 * not leave orphan `eval+...@alongside.invalid` rows in the table.
 */

import { eq } from "drizzle-orm";

import { careProfile, createDbClient, users } from "@alongside/db";

export type SeededEvalUser = {
  userId: string;
  email: string;
  dispose: () => Promise<void>;
};

function isoStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Creates a `users` row and a minimal `care_profile` row.
 *
 * The care profile is intentionally seeded with empty `stage_answers` so that
 * `loadStageForUser` returns `null` (the "no stage filter" path used by users
 * who haven't completed onboarding). This exercises the loadStage SQL without
 * forcing the eval to commit to a stage. Set `stageAnswers` if a future eval
 * needs stage-filtered retrieval.
 */
export async function seedEvalUser(
  databaseUrl: string,
  runner: "retrieval" | "safety" | "answers" | "redteam",
  opts: { withCareProfile?: boolean; stageAnswers?: Record<string, unknown> } = {},
): Promise<SeededEvalUser> {
  const withCareProfile = opts.withCareProfile ?? true;
  const ts = isoStamp();
  const rand = Math.random().toString(36).slice(2, 8);
  const email = `eval+${runner}+${ts}@alongside.invalid`;
  const cognitoSub = `eval-${runner}-${ts}-${rand}`;

  const db = createDbClient(databaseUrl);

  const [u] = await db
    .insert(users)
    .values({ email, cognitoSub, displayName: `Eval ${runner}` })
    .returning({ id: users.id });
  if (!u) throw new Error("seedEvalUser: insert returned no row");

  if (withCareProfile) {
    await db.insert(careProfile).values({
      userId: u.id,
      crFirstName: "Eval",
      crRelationship: "parent",
      stageAnswers: opts.stageAnswers ?? {},
    });
  }

  let disposed = false;
  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    try {
      // care_profile cascades on user delete (FK onDelete: "cascade").
      await db.delete(users).where(eq(users.id, u.id));
    } catch (err) {
      console.warn("eval.seed.dispose.failed", {
        userId: u.id,
        email,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return { userId: u.id, email, dispose };
}
