/** Fixed spacing per bucket (TASK-037 SM-2-lite). Amend via ADR 0026 only. */
export const SRS_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60] as const;

export type SrsBucket = 0 | 1 | 2 | 3 | 4 | 5;

export type SrsLastOutcome = "completed" | "started_not_completed" | "revisit_requested";

export type SrsScheduleRow = {
  bucket: number;
  dueAt: Date;
  lastSeenAt: Date;
  lastOutcome: SrsLastOutcome;
};

const MS_DAY = 24 * 60 * 60 * 1000;

export function intervalDaysForBucket(bucket: number): number {
  const b = Math.min(5, Math.max(0, bucket));
  return SRS_INTERVAL_DAYS[b] ?? 1;
}

export function addDays(now: Date, days: number): Date {
  return new Date(now.getTime() + days * MS_DAY);
}

/** First lesson start for this module (TASK-037 §2). */
export function scheduleOnLessonStart(now: Date): Omit<SrsScheduleRow, "lastOutcome"> & { lastOutcome: "started_not_completed" } {
  return {
    bucket: 0,
    dueAt: addDays(now, intervalDaysForBucket(0)),
    lastSeenAt: now,
    lastOutcome: "started_not_completed",
  };
}

/** Lesson completed: bump bucket, or revisit path (TASK-037 §2). */
export function scheduleOnLessonComplete(
  prior: Pick<SrsScheduleRow, "bucket"> | null,
  revisit: boolean,
  now: Date,
): SrsScheduleRow {
  const prevB = prior?.bucket ?? 0;
  if (revisit) {
    const bucket = Math.max(prevB - 2, 1) as SrsBucket;
    return {
      bucket,
      dueAt: addDays(now, intervalDaysForBucket(bucket)),
      lastSeenAt: now,
      lastOutcome: "revisit_requested",
    };
  }
  const bucket = Math.min(prevB + 1, 5) as SrsBucket;
  return {
    bucket,
    dueAt: addDays(now, intervalDaysForBucket(bucket)),
    lastSeenAt: now,
    lastOutcome: "completed",
  };
}

export type SrsDueState = "never_seen" | "due" | "not_yet_due";

export function srsDueState(row: SrsScheduleRow | undefined, now: Date): SrsDueState {
  if (row == null) {
    return "never_seen";
  }
  if (row.dueAt.getTime() <= now.getTime()) {
    return "due";
  }
  return "not_yet_due";
}

/**
 * When strict SRS filtering would remove every module, fall back to the soonest `due_at`
 * (TASK-037 §3 — “most overdue” / earliest scheduled).
 */
export function pickSrsFallbackModuleIds(
  publishedIds: readonly string[],
  rowsByModule: ReadonlyMap<string, Pick<SrsScheduleRow, "dueAt">>,
): string[] {
  const withRow = publishedIds.filter((id) => rowsByModule.has(id));
  if (withRow.length === 0) {
    return [...publishedIds];
  }
  let bestT = Infinity;
  for (const id of withRow) {
    const t = rowsByModule.get(id)!.dueAt.getTime();
    if (t < bestT) {
      bestT = t;
    }
  }
  return withRow.filter((id) => rowsByModule.get(id)!.dueAt.getTime() === bestT);
}

export function applySrsPrefilterToModules<T extends { id: string }>(
  published: readonly T[],
  rowsByModule: ReadonlyMap<string, SrsScheduleRow>,
  now: Date,
): T[] {
  const states = published.map((m) => ({
    m,
    state: srsDueState(rowsByModule.get(m.id), now),
  }));
  const strict = states.filter((s) => s.state === "never_seen" || s.state === "due").map((s) => s.m);
  if (strict.length > 0) {
    return strict;
  }
  const fallbackIds = pickSrsFallbackModuleIds(
    published.map((p) => p.id),
    new Map([...rowsByModule].map(([id, r]) => [id, { dueAt: r.dueAt }])),
  );
  if (fallbackIds.length === published.length) {
    return [...published];
  }
  const allow = new Set(fallbackIds);
  return published.filter((m) => allow.has(m.id));
}

/** Human label for revisit ack (TASK-037 §4). */
export function dueAtToApproximateLabel(dueAt: Date, fromNow: Date): string {
  const days = Math.round((dueAt.getTime() - fromNow.getTime()) / MS_DAY);
  if (days <= 0) {
    return "soon";
  }
  if (days === 1) {
    return "tomorrow";
  }
  if (days <= 4) {
    return "a few days";
  }
  if (days <= 10) {
    return "about a week";
  }
  if (days <= 21) {
    return "a couple of weeks";
  }
  if (days <= 45) {
    return "about a month";
  }
  return "about two months";
}
