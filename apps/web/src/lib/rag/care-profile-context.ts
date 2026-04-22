import "server-only";

import type { CareProfileRow } from "@/lib/onboarding/status";

/**
 * Condensed, non-PII-heavy view of the care profile for the answering prompt.
 * Excludes free-text diagnosis; stage / living situation use structured field values.
 */
export function buildCareProfileContextMd(profile: CareProfileRow | null): string {
  if (!profile) return "";
  const parts: string[] = [];
  const name = profile.crFirstName?.trim();
  if (name) {
    parts.push(`Care recipient first name: ${name}.`);
  }
  if (profile.hardestThing?.trim()) {
    parts.push(`Hardest thing right now: ${profile.hardestThing.trim()}`);
  }
  if (profile.inferredStage?.trim()) {
    parts.push(`Inferred day-to-day support stage: ${profile.inferredStage}.`);
  }
  if (profile.livingSituation?.trim()) {
    parts.push(`Living situation: ${profile.livingSituation}.`);
  }
  if (profile.crBackground?.trim()) {
    parts.push(`Background: ${profile.crBackground.trim()}`);
  }
  return parts.join("\n");
}
