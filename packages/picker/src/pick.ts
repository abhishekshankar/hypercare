import { and, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { createDbClient } from "@hypercare/db";
import {
  careProfile,
  careProfileChanges,
  lessonProgress,
  moduleTopics,
  modules,
} from "@hypercare/db";
import { getRecentTopicSignal } from "@hypercare/rag";

import { inferStageFromAnswers } from "./infer-stage.js";
import { pickThisWeeksFocusFromData } from "./pick-candidates.js";
import type { PickerResult, PickerStage } from "./types.js";

const MS_DAY = 24 * 60 * 60 * 1000;
const PICKER_WINDOW_DAYS = 14;
const PROFILE_WINDOW_DAYS = 7;

export type PickerRunDeps = {
  db: ReturnType<typeof createDbClient>;
  now: () => Date;
};

/**
 * Picks a published module for the home "This week's focus" card (metadata-only, no LLM).
 */
export async function pickThisWeeksFocus(
  input: { userId: string },
  deps: PickerRunDeps,
): Promise<PickerResult> {
  const now = deps.now();
  const from14 = new Date(now.getTime() - PICKER_WINDOW_DAYS * MS_DAY);
  const from7 = new Date(now.getTime() - PROFILE_WINDOW_DAYS * MS_DAY);
  const db = deps.db;

  const modRows = await db
    .select({
      id: modules.id,
      slug: modules.slug,
      title: modules.title,
      createdAt: modules.createdAt,
      stageRelevance: modules.stageRelevance,
    })
    .from(modules)
    .where(eq(modules.published, true))
    .orderBy(modules.createdAt);

  if (modRows.length === 0) {
    return { kind: "no_pick", reason: "no_eligible_modules" };
  }

  const idList = modRows.map((m: (typeof modRows)[number]) => m.id);
  const topicRows = await db
    .select({ moduleId: moduleTopics.moduleId, topicSlug: moduleTopics.topicSlug })
    .from(moduleTopics)
    .where(inArray(moduleTopics.moduleId, idList));

  const topicByMod = new Map<string, string[]>();
  for (const m of modRows) {
    topicByMod.set(m.id, []);
  }
  for (const t of topicRows) {
    const arr = topicByMod.get(t.moduleId);
    if (arr) {
      arr.push(t.topicSlug);
    }
  }

  const publishedModules = modRows.map((m: (typeof modRows)[number]) => ({
    id: m.id,
    slug: m.slug,
    title: m.title,
    createdAt: m.createdAt,
    stageRelevance: m.stageRelevance,
    topicSlugs: topicByMod.get(m.id) ?? [],
  }));

  const doneRecent = await db
    .select({ moduleId: lessonProgress.moduleId })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, input.userId),
        isNotNull(lessonProgress.completedAt),
        gte(lessonProgress.completedAt, from14),
      ),
    );

  const recentlyCompletedModuleIds = new Set(
    doneRecent.map((r: (typeof doneRecent)[number]) => r.moduleId as string),
  );

  const changes = await db
    .select({
      field: careProfileChanges.field,
      section: careProfileChanges.section,
      oldValue: careProfileChanges.oldValue,
      newValue: careProfileChanges.newValue,
      changedAt: careProfileChanges.changedAt,
    })
    .from(careProfileChanges)
    .where(
      and(eq(careProfileChanges.userId, input.userId), gte(careProfileChanges.changedAt, from7)),
    )
    .orderBy(desc(careProfileChanges.changedAt));

  const [cp] = await db
    .select({
      inferredStage: careProfile.inferredStage,
      stageAnswers: careProfile.stageAnswers,
    })
    .from(careProfile)
    .where(eq(careProfile.userId, input.userId))
    .limit(1);

  let userStage: PickerStage | null = null;
  if (cp) {
    const inferred = cp.inferredStage;
    if (inferred === "early" || inferred === "middle" || inferred === "late") {
      userStage = inferred;
    } else {
      userStage = inferStageFromAnswers(cp.stageAnswers);
    }
  }

  const topicSignal = await getRecentTopicSignal(input.userId, { db, now: deps.now });

  return pickThisWeeksFocusFromData({
    now,
    recentlyCompletedModuleIds,
    publishedModules,
    profileChanges7d: changes,
    topTopics: topicSignal.topTopics,
    userStage,
  });
}
