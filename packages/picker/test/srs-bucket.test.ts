import { describe, expect, it } from "vitest";

import {
  SRS_INTERVAL_DAYS,
  addDays,
  intervalDaysForBucket,
  scheduleOnLessonComplete,
  scheduleOnLessonStart,
} from "../src/srs.js";

const now = new Date("2026-04-22T12:00:00.000Z");

describe("SRS_INTERVAL_DAYS", () => {
  it("matches TASK-037 strawman [1,3,7,14,30,60]", () => {
    expect([...SRS_INTERVAL_DAYS]).toEqual([1, 3, 7, 14, 30, 60]);
  });
});

describe("scheduleOnLessonStart", () => {
  it("uses bucket 0 and 1d horizon", () => {
    const s = scheduleOnLessonStart(now);
    expect(s.bucket).toBe(0);
    expect(s.lastOutcome).toBe("started_not_completed");
    expect(s.dueAt).toEqual(addDays(now, intervalDaysForBucket(0)));
  });
});

describe("scheduleOnLessonComplete", () => {
  it("bumps bucket on Got it", () => {
    const s = scheduleOnLessonComplete({ bucket: 2 }, false, now);
    expect(s.bucket).toBe(3);
    expect(s.lastOutcome).toBe("completed");
    expect(s.dueAt).toEqual(addDays(now, intervalDaysForBucket(3)));
  });

  it("clamps bucket at 5", () => {
    const s = scheduleOnLessonComplete({ bucket: 5 }, false, now);
    expect(s.bucket).toBe(5);
  });

  it("revisit pulls bucket down but not below 1", () => {
    const s = scheduleOnLessonComplete({ bucket: 3 }, true, now);
    expect(s.bucket).toBe(1);
    expect(s.lastOutcome).toBe("revisit_requested");
    expect(s.dueAt).toEqual(addDays(now, intervalDaysForBucket(1)));
  });

  it("first completion without prior schedule row behaves as bucket 0 → 1", () => {
    const s = scheduleOnLessonComplete(null, false, now);
    expect(s.bucket).toBe(1);
  });
});
