import "server-only";
import { and, eq } from "drizzle-orm";
import { createDbClient, lessonProgress, modules } from "@hypercare/db";

import { serverEnv } from "@/lib/env.server";
import type { LessonSource } from "./source";
export type { LessonSource } from "./source";
export { parseLessonSource } from "./source";

export async function startLessonProgress(args: {
  userId: string;
  moduleSlug: string;
  source: LessonSource;
}): Promise<{ progressId: string } | "not_found"> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [m] = await db.select({ id: modules.id }).from(modules).where(eq(modules.slug, args.moduleSlug)).limit(1);
  if (!m) {
    return "not_found";
  }
  const [row] = await db
    .insert(lessonProgress)
    .values({
      userId: args.userId,
      moduleId: m.id,
      source: args.source,
    })
    .returning({ id: lessonProgress.id });
  if (!row) {
    return "not_found";
  }
  return { progressId: row.id };
}

export async function completeLessonProgress(args: {
  userId: string;
  progressId: string;
  revisit: boolean;
}): Promise<"ok" | "not_found"> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const now = new Date();
  const [updated] = await db
    .update(lessonProgress)
    .set({ completedAt: now, revisit: args.revisit })
    .where(
      and(eq(lessonProgress.id, args.progressId), eq(lessonProgress.userId, args.userId)),
    )
    .returning({ id: lessonProgress.id });
  if (!updated) {
    return "not_found";
  }
  return "ok";
}
