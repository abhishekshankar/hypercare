/**
 * Daily retention job. Prefer EventBridge → Lambda in production; run locally with:
 *   pnpm --filter @alongside/db exec tsx src/scripts/retention-cron.ts --dry-run
 */
import { parseArgs } from "node:util";
import { count, lt } from "drizzle-orm";
import { createDbClient } from "../client.js";
import { requireDatabaseUrl } from "../env.js";
import { type RetentionTableName, RETENTION_SCHEDULE } from "../retention/schedule.js";
import { adminAudit } from "../schema/admin-audit.js";
import { conversationMemory } from "../schema/conversation-memory.js";
import { conversationMemoryForgotten } from "../schema/conversation-memory-forgotten.js";
import { conversations } from "../schema/conversations.js";
import { lessonProgress } from "../schema/lesson-progress.js";
import { lessonReviewSchedule } from "../schema/lesson-review-schedule.js";
import { messages } from "../schema/messages.js";
import { modelRoutingDecisions } from "../schema/model-routing-decisions.js";
import { moduleStateTransitions } from "../schema/module-state-transitions.js";
import { privacyExportRequests } from "../schema/privacy-export-requests.js";
import { safetyFlags } from "../schema/safety-flags.js";
import { sessionRevocations } from "../schema/session-revocations.js";
import { userActions } from "../schema/user-actions.js";
import { userAuthSessions } from "../schema/user-auth-sessions.js";
import { userSessions } from "../schema/user-sessions.js";
import { userSuppression } from "../schema/user-suppression.js";
import { weeklyCheckins } from "../schema/weekly-checkins.js";

function cutoffForDays(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Drizzle + postgres-js delete result shape varies by version; normalize for logging. */
function deletedRowCount(result: unknown): number {
  if (result == null || typeof result !== "object") return 0;
  const o = result as { rowCount?: number | null; count?: number | null };
  if (typeof o.rowCount === "number") return o.rowCount;
  if (typeof o.count === "number") return o.count;
  return 0;
}

function parseArg(): { dryRun: boolean } {
  const { values } = parseArgs({
    options: { "dry-run": { type: "boolean", default: false } },
  });
  return { dryRun: values["dry-run"] };
}

export async function runRetentionCron(
  databaseUrl: string,
  options: { dryRun: boolean; log?: (s: string) => void },
): Promise<void> {
  const log = options.log ?? ((s: string) => {
    console.log(s);
  });
  const db = createDbClient(databaseUrl);

  for (const [name, rule] of Object.entries(RETENTION_SCHEDULE) as [
    RetentionTableName,
    (typeof RETENTION_SCHEDULE)[RetentionTableName],
  ][]) {
    if (rule.kind !== "rolling") {
      continue;
    }
    const days = rule.days;
    const co = cutoffForDays(days);

    if (name === "conversations") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(conversations)
          .where(lt(conversations.createdAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (created_at)`);
      } else {
        const del = await db.delete(conversations).where(lt(conversations.createdAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "messages") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(messages)
          .where(lt(messages.createdAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (created_at)`);
      } else {
        const del = await db.delete(messages).where(lt(messages.createdAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "conversation_memory") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(conversationMemory)
          .where(lt(conversationMemory.lastRefreshedAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (last_refreshed_at)`);
      } else {
        const del = await db
          .delete(conversationMemory)
          .where(lt(conversationMemory.lastRefreshedAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "conversation_memory_forgotten") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(conversationMemoryForgotten)
          .where(lt(conversationMemoryForgotten.forgottenAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (forgotten_at)`);
      } else {
        const del = await db
          .delete(conversationMemoryForgotten)
          .where(lt(conversationMemoryForgotten.forgottenAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "lesson_progress") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(lessonProgress)
          .where(lt(lessonProgress.startedAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (started_at)`);
      } else {
        const del = await db.delete(lessonProgress).where(lt(lessonProgress.startedAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "lesson_review_schedule") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(lessonReviewSchedule)
          .where(lt(lessonReviewSchedule.updatedAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (updated_at)`);
      } else {
        const del = await db
          .delete(lessonReviewSchedule)
          .where(lt(lessonReviewSchedule.updatedAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "weekly_checkins") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(weeklyCheckins)
          .where(lt(weeklyCheckins.promptedAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (prompted_at)`);
      } else {
        const del = await db
          .delete(weeklyCheckins)
          .where(lt(weeklyCheckins.promptedAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "safety_flags") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(safetyFlags)
          .where(lt(safetyFlags.createdAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (created_at)`);
      } else {
        const del = await db.delete(safetyFlags).where(lt(safetyFlags.createdAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "admin_audit") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(adminAudit)
          .where(lt(adminAudit.at, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (at)`);
      } else {
        const del = await db.delete(adminAudit).where(lt(adminAudit.at, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "user_sessions") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(userSessions)
          .where(lt(userSessions.visitedAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (visited_at)`);
      } else {
        const del = await db.delete(userSessions).where(lt(userSessions.visitedAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "user_suppression") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(userSuppression)
          .where(lt(userSuppression.setAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (set_at)`);
      } else {
        const del = await db.delete(userSuppression).where(lt(userSuppression.setAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "module_state_transitions") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(moduleStateTransitions)
          .where(lt(moduleStateTransitions.createdAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (created_at)`);
      } else {
        const del = await db
          .delete(moduleStateTransitions)
          .where(lt(moduleStateTransitions.createdAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "session_revocations") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(sessionRevocations)
          .where(lt(sessionRevocations.revokedAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (revoked_at)`);
      } else {
        const del = await db
          .delete(sessionRevocations)
          .where(lt(sessionRevocations.revokedAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "user_auth_sessions") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(userAuthSessions)
          .where(lt(userAuthSessions.lastSeenAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (last_seen_at)`);
      } else {
        const del = await db
          .delete(userAuthSessions)
          .where(lt(userAuthSessions.lastSeenAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "privacy_export_requests") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(privacyExportRequests)
          .where(lt(privacyExportRequests.createdAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (created_at)`);
      } else {
        const del = await db
          .delete(privacyExportRequests)
          .where(lt(privacyExportRequests.createdAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "model_routing_decisions") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(modelRoutingDecisions)
          .where(lt(modelRoutingDecisions.createdAt, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (created_at)`);
      } else {
        const del = await db.delete(modelRoutingDecisions).where(lt(modelRoutingDecisions.createdAt, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
    if (name === "user_actions") {
      if (options.dryRun) {
        const r = await db
          .select({ n: count() })
          .from(userActions)
          .where(lt(userActions.at, co));
        log(`[dry-run] ${name}: would delete ${String(r[0]?.n ?? 0)} rows (at)`);
      } else {
        const del = await db.delete(userActions).where(lt(userActions.at, co));
        log(`retention.rows_deleted{table=${name}} ${String(deletedRowCount(del))}`);
      }
      continue;
    }
  }
}

const isMain = process.argv[1]?.includes("retention-cron");
if (isMain) {
  const { dryRun } = parseArg();
  const url = requireDatabaseUrl();
  await runRetentionCron(url, { dryRun });
  process.exit(0);
}
