/** Layer-2 query-classifier routing topic (TASK-009 / TASK-042). */
export type RoutingTopic =
  | "medical"
  | "medication"
  | "behavioral"
  | "self_care"
  | "logistics"
  | "other";

export type RoutingUrgency = "low" | "normal" | "elevated";

/** Snapshot consumed by the router (mirrors classifier output). */
export type ClassifierVerdict = {
  topic: RoutingTopic;
  urgency: RoutingUrgency;
  /** Care stage when known; `null` if unknown. */
  stage: "early" | "middle" | "late" | null;
  /** True when the composed answer is expected to follow a refusal-style template. */
  is_refusal_template: boolean;
};

export type UserContext = {
  /** `users.id` */
  userId: string;
  /** A/B cohort id from `users.routing_cohort`. */
  routingCohort: string | null;
  /** Care-profile stage when available (TASK-038 hook). */
  profileStage?: "early" | "middle" | "late" | null;
  /** Co-caregivers + primary count when available (TASK-038 hook). */
  memberCount?: number | null;
};

export type RouteMatch = {
  topic?: RoutingTopic;
  is_refusal_template?: boolean;
};

export type PolicyRouteRow = {
  match: RouteMatch;
  model_id: string;
  reason: string;
};

export type AbOverrideRow = {
  cohort: string;
  note?: string;
};

export type ModelRoutingPolicy = {
  policy_version: number;
  default_model_id: string;
  routes: PolicyRouteRow[];
  ab_overrides?: AbOverrideRow[];
};

export type RouteDecision = {
  modelId: string;
  reason: string;
  policyVersion: number;
  /** Index into `policy.routes`, or `null` when the default model is used. */
  matchedRuleIndex: number | null;
};

export const ROUTING_COHORT_CONTROL = "routing_v1_control" as const;
export const ROUTING_COHORT_TREATMENT = "routing_v1_treatment" as const;

export type RoutingCohortId = typeof ROUTING_COHORT_CONTROL | typeof ROUTING_COHORT_TREATMENT;
