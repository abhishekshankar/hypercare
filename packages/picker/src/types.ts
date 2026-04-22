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
    }
  | { kind: "no_pick"; reason: "no_eligible_modules" };
