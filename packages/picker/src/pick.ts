import { and, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { createDbClient } from "@hypercare/db";
import {
  careProfile,
  careProfileChanges,
  getCareProfileForUser,
  MultipleProfilesNotSupportedError,
  lessonProgress,
  lessonReviewSchedule,
  listHouseholdActorUserIds,
  moduleTopics,
  modules,
} from "@hypercare/db";
import { inferInferredStage, type CareProfileStageSnapshot } from "@hypercare/content/stage-rules";
import { getRecentTopicSignal } from "@hypercare/rag";
import { pickThisWeeksFocusFromData, type PickerModuleRow } from "./pick-candidates.js";
import { applySrsPrefilterToModules, type SrsLastOutcome, type SrsScheduleRow } from "./srs.js";
import type { PickerResult, PickerStage } from "./types.js";

const MS_DAY = 24 * 60 * 60 * 1000;
const PICKER_WINDOW_DAYS = 14;
const PROFILE_WINDOW_DAYS = 7;

export type PickerRunDeps = {
  db: ReturnType<typeof createDbClient>;
  now: () => Date;
};

function mapScheduleRows(
  rows: {
    moduleId: string;
    bucket: number;
    dueAt: Date;
    lastSeenAt: Date;
    lastOutcome: string;
  }[],
): Map<string, SrsScheduleRow> {
  const m = new Map<string, SrsScheduleRow>();
  for (const r of rows) {
    m.set(r.moduleId, {
      bucket: r.bucket,
      dueAt: r.dueAt,
      lastSeenAt: r.lastSeenAt,
      lastOutcome: r.lastOutcome as SrsLastOutcome,
    });
  }
  return m;
}

function attachReviewResurface(
  result: PickerResult,
  scheduleByModule: ReadonlyMap<string, SrsScheduleRow>,
  now: Date,
): PickerResult {
  if (result.kind !== "pick") {
    return result;
  }
  const row = scheduleByModule.get(result.moduleId);
  if (row == null || row.lastOutcome === "started_not_completed") {
    return result;
  }
  const days = Math.floor((now.getTime() - row.lastSeenAt.getTime()) / MS_DAY);
  if (days < 1) {
    return result;
  }
  return { ...result, reviewResurface: { lastSeenDaysAgo: days } };
}

/**
 * Picks a published module for the home "This week's focus" card (metadata-only, no LLM).
 * TASK-037: SRS pre-filter narrows candidates before TASK-024 scoring.
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

  const scheduleRows = await db
    .select({
      moduleId: lessonReviewSchedule.moduleId,
      bucket: lessonReviewSchedule.bucket,
      dueAt: lessonReviewSchedule.dueAt,
      lastSeenAt: lessonReviewSchedule.lastSeenAt,
      lastOutcome: lessonReviewSchedule.lastOutcome,
    })
    .from(lessonReviewSchedule)
    .where(eq(lessonReviewSchedule.userId, input.userId));

  const scheduleByModule = mapScheduleRows(scheduleRows);

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

  const publishedModulesFull: PickerModuleRow[] = modRows.map((m: (typeof modRows)[number]) => ({
    id: m.id,
    slug: m.slug,
    title: m.title,
    createdAt: m.createdAt,
    stageRelevance: m.stageRelevance,
    topicSlugs: topicByMod.get(m.id) ?? [],
  }));

  const publishedModules: PickerModuleRow[] = applySrsPrefilterToModules(
    publishedModulesFull,
    scheduleByModule,
    now,
  );

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

  const recentlyCompletedBaseline = new Set<string>(
    doneRecent.map((r: (typeof doneRecent)[number]) => String(r.moduleId)),
  );
  const recentlyCompletedModuleIds = new Set(recentlyCompletedBaseline);
  for (const r of scheduleRows) {
    if (r.dueAt.getTime() <= now.getTime()) {
      recentlyCompletedModuleIds.delete(r.moduleId as string);
    }
  }

  let bundle: Awaited<ReturnType<typeof getCareProfileForUser>>;
  try {
    bundle = await getCareProfileForUser(db, input.userId);
  } catch (e) {
    if (e instanceof MultipleProfilesNotSupportedError) {
      return { kind: "no_pick", reason: "multiple_profiles" };
    }
    throw e;
  }
  let householdActorIds: string[] = [input.userId];
  let cp: {
    inferredStage: string | null;
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

  if (bundle != null) {
    const ids = await listHouseholdActorUserIds(db, bundle.profile.id);
    householdActorIds = ids.length > 0 ? ids : [input.userId];
    const p = bundle.profile;
    cp = {
      inferredStage: p.inferredStage,
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
    const [row] = await db
      .select({
        inferredStage: careProfile.inferredStage,
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
      .where(eq(careProfile.userId, input.userId))
      .limit(1);
    cp = row ?? null;
  }

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
      and(
        inArray(careProfileChanges.changedBy, householdActorIds),
        gte(careProfileChanges.changedAt, from7),
      ),
    )
    .orderBy(desc(careProfileChanges.changedAt));

  let userStage: PickerStage | null = null;
  if (cp) {
    const inferred = cp.inferredStage;
    if (inferred === "early" || inferred === "middle" || inferred === "late") {
      userStage = inferred;
    } else {
      userStage = inferInferredStage({
        stageQuestionsVersion: cp.stageQuestionsVersion,
        stageAnswers: cp.stageAnswers,
        medManagementV1: cp.medManagementV1,
        drivingV1: cp.drivingV1,
        aloneSafetyV1: cp.aloneSafetyV1,
        recognitionV1: cp.recognitionV1,
        bathingDressingV1: cp.bathingDressingV1,
        wanderingV1: cp.wanderingV1,
        conversationV1: cp.conversationV1,
        sleepV1: cp.sleepV1,
      } as CareProfileStageSnapshot);
    }
  }

  const topicSignal = await getRecentTopicSignal(input.userId, { db, now: deps.now });

  let result = pickThisWeeksFocusFromData({
    now,
    recentlyCompletedModuleIds,
    publishedModules,
    profileChanges7d: changes,
    topTopics: topicSignal.topTopics,
    userStage,
  });

  if (result.kind === "no_pick" && publishedModules.length < publishedModulesFull.length) {
    result = pickThisWeeksFocusFromData({
      now,
      recentlyCompletedModuleIds: new Set(recentlyCompletedBaseline),
      publishedModules: publishedModulesFull,
      profileChanges7d: changes,
      topTopics: topicSignal.topTopics,
      userStage,
    });
  }

  return attachReviewResurface(result, scheduleByModule, now);
}
