import type { PickerRationale, PickerResult } from "@hypercare/picker";

function humanizeTopicSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * One-line subtitle for the "This week's focus" card (TASK-024).
 */
export function refineFocusSubtitle(
  result: PickerResult,
  hardestThing: string | null | undefined,
): string {
  if (result.kind === "pick" && result.rationale.kind === "profile_change" && result.rationale.field === "hardest_thing") {
    const t = (hardestThing ?? "").toLowerCase();
    if (t.includes("guilt")) {
      return "Because you said guilt is the hardest thing right now.";
    }
  }
  return focusCardSubtitle(result);
}

export function focusCardSubtitle(result: PickerResult): string {
  if (result.kind !== "pick") {
    return "";
  }
  const r: PickerRationale = result.rationale;
  switch (r.kind) {
    case "stage_baseline": {
      if (r.stage == null) {
        return "Because your stage answers suggest starting here.";
      }
      return `Because ${r.stage} stage often brings this.`;
    }
    case "recent_topic": {
      return `Because you've been asking about ${humanizeTopicSlug(r.topicSlug)}.`;
    }
    case "profile_change": {
      if (r.field === "hardest_thing") {
        return "Because you said what is hardest right now shifted for you.";
      }
      if (r.field === "inferred_stage") {
        return "Because your care stage recently shifted.";
      }
      return "Because your profile changed recently.";
    }
    case "manual_featured": {
      return "Featured for you this week.";
    }
    default: {
      const _e: never = r;
      return _e;
    }
  }
}
