/**
 * "This week's focus" picker (TASK-024).
 */

export type PickerStage = "early" | "middle" | "late";

export type PickerRationale =
  | { kind: "stage_baseline"; stage: PickerStage | null }
  | { kind: "recent_topic"; topicSlug: string }
  | { kind: "profile_change"; field: string }
  | { kind: "manual_featured" };

export type PickerResult =
  | {
      kind: "pick";
      moduleId: string;
      slug: string;
      title: string;
      rationale: PickerRationale;
      /** TASK-037: surfaced again after a prior completion / revisit (not `started_not_completed` only). */
      reviewResurface?: { lastSeenDaysAgo: number };
    }
  | { kind: "no_pick"; reason: "no_eligible_modules" | "multiple_profiles" };
