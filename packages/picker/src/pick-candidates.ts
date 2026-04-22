import type { PickerRationale, PickerResult, PickerStage } from "./types.js";
import { mapHardestTextToTopicSlug } from "./hardest-map.js";

export type PickerModuleRow = {
  id: string;
  slug: string;
  title: string;
  createdAt: Date;
  stageRelevance: string[];
  topicSlugs: string[];
};

export type ProfileChangeRow = {
  field: string;
  section: string;
  changedAt: Date;
  oldValue: unknown;
  newValue: unknown;
};

const MS_DAY = 24 * 60 * 60 * 1000;

function isCompletedRecently(moduleId: string, exclude: ReadonlySet<string>): boolean {
  return exclude.has(moduleId);
}

function sortByCreatedAtAsc(mods: PickerModuleRow[]): PickerModuleRow[] {
  return [...mods].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function pickFirstEligible(
  ordered: PickerModuleRow[],
  recentCompleted: ReadonlySet<string>,
  allowRepeatOnlyIfExhausted: boolean,
  predicate: (m: PickerModuleRow) => boolean,
): PickerModuleRow | null {
  const eligible = ordered.filter(
    (m) => predicate(m) && !isCompletedRecently(m.id, recentCompleted),
  );
  if (eligible.length > 0) {
    return eligible[0] ?? null;
  }
  if (!allowRepeatOnlyIfExhausted) {
    return null;
  }
  const any = ordered.filter((m) => predicate(m));
  return any[0] ?? null;
}

function stageMatches(mod: PickerModuleRow, stage: PickerStage | null): boolean {
  if (stage == null) {
    return true;
  }
  return mod.stageRelevance.includes(stage);
}

/**
 * Pure picker policy (profile → recent topic → stage baseline). Excludes modules
 * completed in the last 14 days; step 3 may re-pick a recent completion only
 * when no other module matches the stage / null filter.
 */
export function pickThisWeeksFocusFromData(input: {
  now: Date;
  /** Rolling window: modules with a completion in this set are "recent". */
  recentlyCompletedModuleIds: Set<string>;
  publishedModules: PickerModuleRow[];
  profileChanges7d: ProfileChangeRow[];
  topTopics: { slug: string; weight: number }[];
  userStage: PickerStage | null;
}): PickerResult {
  const { now, publishedModules, recentlyCompletedModuleIds, profileChanges7d, topTopics, userStage } = input;
  if (publishedModules.length === 0) {
    return { kind: "no_pick", reason: "no_eligible_modules" };
  }

  const byCreated = sortByCreatedAtAsc(publishedModules);
  const sevenAgo = new Date(now.getTime() - 7 * MS_DAY);

  const changes = [...profileChanges7d].filter((c) => c.changedAt >= sevenAgo);
  changes.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());

  // Step 1 — profile change: hardest_thing
  for (const c of changes) {
    if (c.field === "hardest_thing" && c.section === "what_matters") {
      const raw =
        typeof c.newValue === "string" ? c.newValue : String(c.newValue ?? "");
      const topicSlug = mapHardestTextToTopicSlug(raw);
      if (topicSlug) {
        const m = pickFirstEligible(
          byCreated,
          recentlyCompletedModuleIds,
          false,
          (mod) => mod.topicSlugs.includes(topicSlug),
        );
        if (m) {
          return {
            kind: "pick" as const,
            moduleId: m.id,
            slug: m.slug,
            title: m.title,
            rationale: { kind: "profile_change", field: "hardest_thing" },
          };
        }
      }
      break;
    }
  }

  // Step 1b — inferred stage flipped (logged in change-log)
  for (const c of changes) {
    if (c.field === "inferred_stage" && c.section === "stage") {
      const newS = typeof c.newValue === "string" ? c.newValue : null;
      const oldS = typeof c.oldValue === "string" ? c.oldValue : null;
      if (
        newS != null &&
        (newS === "early" || newS === "middle" || newS === "late") &&
        newS !== oldS
      ) {
        const stage = newS as PickerStage;
        const m = pickFirstEligible(
          byCreated,
          recentlyCompletedModuleIds,
          false,
          (mod) => stageMatches(mod, stage),
        );
        if (m) {
          return {
            kind: "pick" as const,
            moduleId: m.id,
            slug: m.slug,
            title: m.title,
            rationale: { kind: "profile_change", field: "inferred_stage" },
          };
        }
      }
      break;
    }
  }

  // Step 2 — recent topic signal
  for (const t of topTopics) {
    const m = pickFirstEligible(
      byCreated,
      recentlyCompletedModuleIds,
      false,
      (mod) => mod.topicSlugs.includes(t.slug),
    );
    if (m) {
      return {
        kind: "pick" as const,
        moduleId: m.id,
        slug: m.slug,
        title: m.title,
        rationale: { kind: "recent_topic", topicSlug: t.slug },
      };
    }
  }

  // Step 3 — stage baseline (round-robin by created_at; allow repeat if exhausted)
  const m3 = pickFirstEligible(
    byCreated,
    recentlyCompletedModuleIds,
    true,
    (mod) => stageMatches(mod, userStage),
  );
  if (m3) {
    return {
      kind: "pick" as const,
      moduleId: m3.id,
      slug: m3.slug,
      title: m3.title,
      rationale: { kind: "stage_baseline", stage: userStage },
    };
  }

  return { kind: "no_pick", reason: "no_eligible_modules" };
}

/** Build human-facing rationale; web maps this to a card subtitle. */
export function defaultRationaleLine(r: PickerRationale): string {
  switch (r.kind) {
    case "stage_baseline": {
      if (r.stage == null) {
        return "Because your stage answers suggest starting here";
      }
      return `Because ${r.stage} stage often brings this`;
    }
    case "recent_topic": {
      return `Because you've been asking about ${r.topicSlug.replaceAll("-", " ")}`;
    }
    case "profile_change": {
      if (r.field === "hardest_thing") {
        return "Because you updated what is hardest right now";
      }
      if (r.field === "inferred_stage") {
        return "Because your care stage recently shifted";
      }
      return "Because your profile changed recently";
    }
    case "manual_featured": {
      return "Featured for you this week";
    }
    default: {
      const _x: never = r;
      return _x;
    }
  }
}
