/**
 * v0 closed vocabulary for `topics` (TASK-019) — must stay in sync with
 * the migration seed in `migrations/0003_schema_v1_retention_loop.sql`. Add
 * new rows here and run `pnpm --filter @alongside/db seed:topics` without
 * a new migration until a breaking taxonomy change.
 */
export const TOPICS_V0: ReadonlyArray<{
  slug: string;
  category: string;
  displayName: string;
}> = [
  { slug: "sundowning", category: "behaviors", displayName: "Sundowning" },
  { slug: "repetitive-questions", category: "behaviors", displayName: "Repetitive questions" },
  { slug: "accusations-paranoia", category: "behaviors", displayName: "Accusations and paranoia" },
  { slug: "agitation-aggression", category: "behaviors", displayName: "Agitation and aggression" },
  { slug: "wandering", category: "behaviors", displayName: "Wandering" },
  { slug: "refusal-of-care", category: "behaviors", displayName: "Refusal of care" },
  { slug: "bathing-resistance", category: "daily_care", displayName: "Bathing resistance" },
  { slug: "eating-swallowing", category: "daily_care", displayName: "Eating and swallowing" },
  { slug: "sleep-problems", category: "daily_care", displayName: "Sleep problems" },
  { slug: "medication-management", category: "daily_care", displayName: "Medication management" },
  { slug: "how-to-talk", category: "communication", displayName: "How to talk" },
  { slug: "non-recognition", category: "communication", displayName: "Non-recognition" },
  { slug: "validation-basics", category: "communication", displayName: "Validation basics" },
  { slug: "understanding-diagnosis", category: "medical", displayName: "Understanding diagnosis" },
  { slug: "hospital-visits", category: "medical", displayName: "Hospital visits" },
  { slug: "power-of-attorney", category: "legal_financial", displayName: "Power of attorney" },
  { slug: "paying-for-care", category: "legal_financial", displayName: "Paying for care" },
  { slug: "caregiver-burnout", category: "caring_for_yourself", displayName: "Caregiver burnout" },
  { slug: "guilt-and-grief", category: "caring_for_yourself", displayName: "Guilt and grief" },
  { slug: "asking-for-help", category: "caring_for_yourself", displayName: "Asking for help" },
  { slug: "new-diagnosis", category: "medical", displayName: "New diagnosis" },
  { slug: "early-stage", category: "medical", displayName: "Early stage" },
  { slug: "ambiguous-grief", category: "caring_for_yourself", displayName: "Ambiguous grief" },
  { slug: "advance-planning", category: "legal_financial", displayName: "Advance planning" },
  { slug: "blood-biomarkers", category: "medical", displayName: "Blood biomarkers" },
  { slug: "guide-model", category: "legal_financial", displayName: "CMS GUIDE model" },
  { slug: "delirium-basics", category: "medical", displayName: "Delirium basics" },
];
