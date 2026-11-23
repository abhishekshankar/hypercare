import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { adminAudit } from "../schema/admin-audit.js";
import { careProfile } from "../schema/care-profile.js";
import { careProfileMembers } from "../schema/care-profile-members.js";
import { careProfileChanges } from "../schema/care-profile-changes.js";
import { conversations } from "../schema/conversations.js";
import { lessonStreamTelemetry } from "../schema/lesson-stream-telemetry.js";
import { lessonProgress } from "../schema/lesson-progress.js";
import { lessonReviewSchedule } from "../schema/lesson-review-schedule.js";
import { moduleStateTransitions } from "../schema/module-state-transitions.js";
import { privacyExportRequests } from "../schema/privacy-export-requests.js";
import { safetyFlags } from "../schema/safety-flags.js";
import { savedAnswers } from "../schema/saved-answers.js";
import { sessionRevocations } from "../schema/session-revocations.js";
import { userActions } from "../schema/user-actions.js";
import { userAuthSessions } from "../schema/user-auth-sessions.js";
import { userSessions } from "../schema/user-sessions.js";
import { userSuppression } from "../schema/user-suppression.js";
import { users } from "../schema/users.js";
import { weeklyCheckins } from "../schema/weekly-checkins.js";
import type { PiiContext } from "./pii-stripping.js";
import { buildPiiResolvers } from "./pii-stripping.js";
import * as schema from "../schema/index.js";

type SchemaDb = PostgresJsDatabase<typeof schema>;

export type AccountDeleteInput = {
  userId: string;
  pii: PiiContext;
  /**
   * Self-serve: `/api/app/privacy/delete`
   * CLI: include operator note (stored in `admin_audit.meta`).
   */
  audit: {
    path: string;
    source: "self_service" | "admin_cli";
    reason?: string;
  };
};

/**
 * De-identify `safety_flags` and delete this user's rows everywhere else in one transaction.
 * Caller invalidates `hc_session` and Cognito (if any) after commit.
 */
export async function deleteUserAccount(db: SchemaDb, input: AccountDeleteInput): Promise<void> {
  const { userId, pii, audit } = input;
  const strip = buildPiiResolvers(pii).strip;

  await db.transaction(async (tx) => {
    const now = new Date();
    const flagRows = await tx
      .select({ id: safetyFlags.id, lastMessageText: safetyFlags.lastMessageText })
      .from(safetyFlags)
      .where(eq(safetyFlags.userId, userId));
    for (const row of flagRows) {
      const last =
        row.lastMessageText != null && row.lastMessageText.length > 0
          ? strip(row.lastMessageText)
          : null;
      if (last !== row.lastMessageText) {
        await tx
          .update(safetyFlags)
          .set({ lastMessageText: last })
          .where(eq(safetyFlags.id, row.id));
      }
    }
    await tx
      .update(safetyFlags)
      .set({
        userId: null,
        messageId: null,
        conversationId: null,
        deidentifiedAt: now,
      })
      .where(eq(safetyFlags.userId, userId));

    const authRows = await tx
      .select({ sessionId: userAuthSessions.sessionId })
      .from(userAuthSessions)
      .where(eq(userAuthSessions.userId, userId));
    if (authRows.length > 0) {
      await tx
        .insert(sessionRevocations)
        .values(
          authRows.map((r) => ({
            sessionId: r.sessionId,
            userId,
            reason: "user_delete" as const,
          })),
        )
        .onConflictDoNothing({ target: sessionRevocations.sessionId });
    }
    await tx.delete(userAuthSessions).where(eq(userAuthSessions.userId, userId));

    await tx.delete(savedAnswers).where(eq(savedAnswers.userId, userId));
    await tx.delete(userActions).where(eq(userActions.userId, userId));
    await tx.delete(privacyExportRequests).where(eq(privacyExportRequests.userId, userId));
    await tx.delete(userSessions).where(eq(userSessions.userId, userId));
    await tx.delete(userSuppression).where(eq(userSuppression.userId, userId));
    await tx.delete(weeklyCheckins).where(eq(weeklyCheckins.userId, userId));
    await tx.delete(lessonStreamTelemetry).where(eq(lessonStreamTelemetry.userId, userId));
    await tx.delete(lessonReviewSchedule).where(eq(lessonReviewSchedule.userId, userId));
    await tx.delete(lessonProgress).where(eq(lessonProgress.userId, userId));
    await tx.delete(careProfileChanges).where(eq(careProfileChanges.userId, userId));
    await tx.delete(careProfileMembers).where(eq(careProfileMembers.userId, userId));
    await tx.delete(careProfile).where(eq(careProfile.userId, userId));
    await tx
      .delete(moduleStateTransitions)
      .where(eq(moduleStateTransitions.byUserId, userId));
    await tx.delete(conversations).where(eq(conversations.userId, userId));

    await tx.insert(adminAudit).values({
      userId,
      path: audit.path,
      reason: "account_delete",
      meta: {
        source: audit.source,
        subjectUserId: userId,
        operatorReason: audit.reason,
      },
    });
    await tx.delete(users).where(eq(users.id, userId));
  });
}
