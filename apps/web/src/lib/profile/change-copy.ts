/**
 * Human-readable lines for `care_profile_changes` — keep copy out of React trees.
 */

import type { ProfileChangePart } from "./change-diff";

const FIELD_LABELS: Record<string, string> = {
  cr_first_name: "their first name",
  cr_age: "their age",
  cr_relationship: "your relationship",
  cr_diagnosis: "diagnosis",
  cr_diagnosis_year: "diagnosis year",
  inferred_stage: "care stage (from your answers)",
  living_situation: "where they live",
  care_network: "who else helps with care",
  care_hours_per_week: "care hours per week",
  caregiver_proximity: "how close you live",
  display_name: "your first name",
  caregiver_age_bracket: "your age range",
  caregiver_work_status: "work status",
  caregiver_state_1_5: "how you’re doing (1–5)",
  hardest_thing: "hardest thing right now",
  cr_background: "background / what they were known for",
  cr_joy: "what brings them joy",
  cr_personality_notes: "personality and history notes",
  anything_else: "what’s new that we should know",
  manages_meds: "whether they manage their own medications",
  drives: "whether they still drive",
  left_alone: "being left alone safely",
  recognizes_you: "whether they recognize you",
  bathes_alone: "bathing and dressing on their own",
  wandering_incidents: "wandering or getting lost",
  conversations: "conversations that make sense",
  sleeps_through_night: "sleeping through the night",
};

function fmt(v: unknown): string {
  if (v == null) {
    return "empty";
  }
  if (typeof v === "string") {
    const t = v.trim();
    return t.length === 0 ? "empty" : t;
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

const STAGE_WORD: Record<string, string> = {
  early: "early",
  middle: "middle",
  late: "late",
  unknown: "uncertain",
};

function fmtStageValue(field: string, v: unknown): string {
  if (field === "inferred_stage" && typeof v === "string" && v in STAGE_WORD) {
    return STAGE_WORD[v] ?? fmt(v);
  }
  if (
    (field === "caregiver_state_1_5" || field === "cr_age" || field === "care_hours_per_week") &&
    (typeof v === "number" || (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))))
  ) {
    return String(v);
  }
  return fmt(v);
}

/**
 * Renders a single change row for the "Recent changes" list.
 * `changedAt` is ISO or Date for relative time; caller supplies formatted relative string if desired.
 */
/** For "2 days ago — You updated…" in Recent changes. */
export function formatChangedAtLabel(iso: string | Date): string {
  const t = typeof iso === "string" ? new Date(iso) : iso;
  const s = (Date.now() - t.getTime()) / 1000;
  if (s < 60) {
    return "just now";
  }
  if (s < 3600) {
    return `${Math.floor(s / 60)} min ago`;
  }
  if (s < 86400) {
    return `${Math.floor(s / 3600)} hours ago`;
  }
  if (s < 604800) {
    return `${Math.floor(s / 86400)} days ago`;
  }
  return t.toLocaleDateString();
}

export function changeSummaryLine(
  part: Pick<ProfileChangePart, "section" | "field" | "oldValue" | "newValue">,
  opts?: {
    relativeTime?: string;
    /** When the viewer is not the editor (TASK-038 co-caregiver audit). */
    editorLabel?: string;
    viewerIsEditor?: boolean;
  },
): string {
  const label = FIELD_LABELS[part.field] ?? part.field.replace(/_/g, " ");
  const oldL = fmtStageValue(part.field, part.oldValue);
  const newL = fmtStageValue(part.field, part.newValue);
  const when = opts?.relativeTime != null && opts.relativeTime.length > 0 ? `${opts.relativeTime} — ` : "";
  const who =
    opts?.viewerIsEditor === true
      ? "You"
      : (opts?.editorLabel?.trim() ?? "Another caregiver");
  if (part.oldValue == null || part.oldValue === "") {
    return `${when}${who} set ${label} to “${newL}”.`;
  }
  return `${when}${who} updated ${label} from “${oldL}” to “${newL}”.`;
}

/** Short label for section headings (one-line summary helpers). */
export function aboutCrOneLiner(p: {
  firstName: string;
  age: number | null;
  diagnosis: string | null;
  diagnosisYear: number | null;
}): string {
  const name = p.firstName.trim() || "Them";
  const age = p.age != null ? `, ${p.age}` : "";
  const dx =
    p.diagnosis != null
      ? `, ${p.diagnosis.replace(/_/g, " ")}`
      : ", diagnosis not specified";
  const yr = p.diagnosisYear != null ? `, ~${p.diagnosisYear} since diagnosis` : "";
  return `${name}${age}${dx}${yr}`;
}

export function formatInferredStage(s: string | null | undefined): string {
  if (s == null || s === "") {
    return "not enough answers yet to infer a stage";
  }
  return STAGE_WORD[s] ?? s;
}
