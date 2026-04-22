import {
  type RetentionTableName,
  type RetentionRule,
  RETENTION_SCHEDULE,
} from "@hypercare/db";

export type RetentionSummaryRow = { label: string; detail: string };

function detailForRule(table: RetentionTableName, rule: RetentionRule): string {
  if (rule.kind === "active_lifetime") {
    return "Kept while your account is active. Removed after account deletion (except where noted in our privacy copy).";
  }
  if (rule.deidentify_on_user_delete) {
    return `Up to ${String(rule.days)} days. On account deletion, de-identified per policy (not hard-deleted).`;
  }
  return `Up to ${String(rule.days)} days, then purged by automated retention.`;
}

/** Human labels for retention tiles (keys track `RETENTION_SCHEDULE` in @hypercare/db). */
const LABEL: Record<string, string> = {
  users: "Account",
  care_profile: "Care profile",
  care_profile_members: "Family sharing (caregivers on a profile)",
  invite_tokens: "Co-caregiver invite links",
  care_profile_changes: "Profile change log",
  conversations: "Conversations",
  messages: "Messages",
  conversation_memory: "Conversation memory (summaries)",
  conversation_memory_forgotten: "Conversation memory — forgotten bullets",
  saved_answers: "Saved answers",
  lesson_stream_telemetry: "Lesson streaming telemetry",
  user_actions: "Product actions (transparency taps, etc.)",
  lesson_progress: "Lesson progress",
  lesson_review_schedule: "Lesson review schedule (spaced repetition)",
  weekly_checkins: "Weekly check-ins",
  safety_flags: "Safety triage (crisis / escalation) flags",
  user_sessions: "In-app visit log (for engagement metrics)",
  user_auth_sessions: "Sign-in device sessions",
  session_revocations: "Session revocations",
  privacy_export_requests: "Data export requests",
  user_suppression: "Distress flow suppression",
  admin_audit: "Operator audit",
  modules: "Content modules",
  module_chunks: "Module text chunks",
  module_versions: "Module version snapshots",
  module_briefs: "Content briefs",
  module_evidence: "Module evidence",
  module_reviews: "Module reviews",
  module_state_transitions: "Module state transitions",
  module_topics: "Module ↔ topic links",
  topics: "Topic vocabulary",
  model_routing_decisions: "Model routing decisions (A/B audit)",
};

/** Renders the “What we keep” table on the profile (must match `RETENTION_SCHEDULE` keys). */
export function getRetentionSummaryRows(): RetentionSummaryRow[] {
  return (Object.keys(RETENTION_SCHEDULE) as RetentionTableName[]).map((table) => ({
    label: LABEL[table] ?? table,
    detail: detailForRule(table, RETENTION_SCHEDULE[table]),
  }));
}
