/**
 * One entry per public SQL table. Used by the retention cron and CI coverage (TASK-032).
 * Rolling windows use `created_at` unless `dateColumn` is set.
 */
export type RetentionRule =
  | { kind: "active_lifetime" }
  | {
      kind: "rolling";
      days: number;
      /** Column to compare to now() (default `created_at`). */
      dateColumn?: string;
      deidentify_on_user_delete?: true;
    };

/** SQL table name → rule (must match `pg_tables.tablename` / Drizzle). */
export const RETENTION_SCHEDULE = {
  users: { kind: "active_lifetime" },
  care_profile: { kind: "active_lifetime" },
  care_profile_members: { kind: "active_lifetime" },
  invite_tokens: { kind: "active_lifetime" },
  care_profile_changes: { kind: "active_lifetime" },
  conversations: { kind: "rolling", days: 365 },
  messages: { kind: "rolling", days: 365 },
  /** Cron uses `last_refreshed_at` (regenerable snapshot). */
  conversation_memory: { kind: "rolling", days: 90, dateColumn: "last_refreshed_at" },
  /** TASK-033: per-conversation “forget this” bullets; also cascade-deleted with `conversations`. */
  conversation_memory_forgotten: { kind: "rolling", days: 365, dateColumn: "forgotten_at" },
  saved_answers: { kind: "active_lifetime" },
  lesson_stream_telemetry: { kind: "rolling", days: 365, dateColumn: "created_at" },
  lesson_progress: { kind: "rolling", days: 730, dateColumn: "started_at" },
  /** TASK-037: SM-2-lite bucket schedule per user + module. */
  lesson_review_schedule: { kind: "rolling", days: 730, dateColumn: "updated_at" },
  weekly_checkins: { kind: "rolling", days: 730, dateColumn: "prompted_at" },
  safety_flags: { kind: "rolling", days: 730, deidentify_on_user_delete: true },
  admin_audit: { kind: "rolling", days: 365 },
  /** TASK-033: transparency forget/refresh/clear taps (metrics + trust). */
  user_actions: { kind: "rolling", days: 365, dateColumn: "at" },
  user_sessions: { kind: "rolling", days: 90, dateColumn: "visited_at" },
  user_suppression: { kind: "rolling", days: 30, dateColumn: "set_at" },
  modules: { kind: "active_lifetime" },
  module_chunks: { kind: "active_lifetime" },
  module_versions: { kind: "active_lifetime" },
  module_briefs: { kind: "active_lifetime" },
  module_evidence: { kind: "active_lifetime" },
  module_reviews: { kind: "active_lifetime" },
  module_state_transitions: { kind: "rolling", days: 730 },
  module_topics: { kind: "active_lifetime" },
  topics: { kind: "active_lifetime" },
  session_revocations: { kind: "rolling", days: 365, dateColumn: "revoked_at" },
  user_auth_sessions: { kind: "rolling", days: 90, dateColumn: "last_seen_at" },
  privacy_export_requests: { kind: "rolling", days: 7 },
  /** TASK-042: Layer-5 routing audit; matches `safety_flags`-class rolling window (ADR 0021). */
  model_routing_decisions: { kind: "rolling", days: 90 },
} as const satisfies Record<string, RetentionRule>;

export type RetentionTableName = keyof typeof RETENTION_SCHEDULE;

export const ALL_RETENTION_TABLES = Object.keys(RETENTION_SCHEDULE) as RetentionTableName[];
