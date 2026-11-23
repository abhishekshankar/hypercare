import { asc, desc, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { careProfile } from "../schema/care-profile.js";
import { careProfileChanges } from "../schema/care-profile-changes.js";
import { conversationMemory } from "../schema/conversation-memory.js";
import { conversations } from "../schema/conversations.js";
import { lessonProgress } from "../schema/lesson-progress.js";
import { lessonReviewSchedule } from "../schema/lesson-review-schedule.js";
import { messages } from "../schema/messages.js";
import { savedAnswers } from "../schema/saved-answers.js";
import { safetyFlags } from "../schema/safety-flags.js";
import { users } from "../schema/users.js";
import { weeklyCheckins } from "../schema/weekly-checkins.js";
import * as schema from "../schema/index.js";

type SchemaDb = PostgresJsDatabase<typeof schema>;

/** JSON-serializable bundle for `/api/app/privacy/export` (TASK-032). */
export async function collectPrivacyExportData(
  db: SchemaDb,
  userId: string,
): Promise<Record<string, unknown>> {
  const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userRow == null) {
    throw new Error("user_not_found");
  }
  const profileRows = await db
    .select()
    .from(careProfile)
    .where(eq(careProfile.userId, userId))
    .limit(1);
  const profile = profileRows[0] ?? null;
  const changes = await db
    .select()
    .from(careProfileChanges)
    .where(eq(careProfileChanges.userId, userId))
    .orderBy(desc(careProfileChanges.changedAt));
  const convs = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(asc(conversations.createdAt));
  const convIds = convs.map((c) => c.id);
  const allMessages =
    convIds.length === 0
      ? []
      : await db
          .select()
          .from(messages)
          .where(inArray(messages.conversationId, convIds))
          .orderBy(asc(messages.createdAt));
  const mem = await db
    .select()
    .from(conversationMemory)
    .where(eq(conversationMemory.userId, userId));
  const lessons = await db
    .select()
    .from(lessonProgress)
    .where(eq(lessonProgress.userId, userId));
  const lessonSchedules = await db
    .select()
    .from(lessonReviewSchedule)
    .where(eq(lessonReviewSchedule.userId, userId));
  const checkins = await db
    .select()
    .from(weeklyCheckins)
    .where(eq(weeklyCheckins.userId, userId));
  const flags = await db.select().from(safetyFlags).where(eq(safetyFlags.userId, userId));
  const saves = await db.select().from(savedAnswers).where(eq(savedAnswers.userId, userId));
  return {
    user: userRow,
    care_profile: profile,
    care_profile_changes: changes,
    conversations: convs,
    messages: allMessages,
    conversation_memory: mem,
    lesson_progress: lessons,
    lesson_review_schedule: lessonSchedules,
    weekly_checkins: checkins,
    safety_flags: flags,
    saved_answers: saves,
  };
}
