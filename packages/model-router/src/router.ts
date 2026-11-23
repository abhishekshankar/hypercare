import type { ClassifierVerdict, ModelRoutingPolicy, RouteDecision, UserContext } from "./types.js";
import { ROUTING_COHORT_CONTROL } from "./types.js";
import { matchSatisfies } from "./policy.js";

export type SelectModelInput = {
  policy: ModelRoutingPolicy;
  classifierVerdict: ClassifierVerdict;
  userContext: UserContext;
  /** Same as `userContext.routingCohort` when known. */
  abCohort: string | null;
};

/**
 * Pick the Bedrock model id for Layer-5 generation.
 *
 * - `routing_v1_control` → always `default_model_id`.
 * - `routing_v1_treatment` (or unknown non-control) → first matching route, else default.
 */
export function selectModel(input: SelectModelInput): RouteDecision {
  const { policy, classifierVerdict: v, userContext } = input;
  /** Unknown / missing cohort defaults to control so we never accidentally run treatment policy. */
  const cohort = input.abCohort ?? userContext.routingCohort ?? ROUTING_COHORT_CONTROL;

  if (cohort === ROUTING_COHORT_CONTROL) {
    return {
      modelId: policy.default_model_id,
      reason: "control cohort — policy disabled for A/B baseline",
      policyVersion: policy.policy_version,
      matchedRuleIndex: null,
    };
  }

  const verdictSlice = { topic: v.topic, is_refusal_template: v.is_refusal_template };
  for (let i = 0; i < policy.routes.length; i++) {
    const row = policy.routes[i]!;
    if (matchSatisfies(row, verdictSlice)) {
      return {
        modelId: row.model_id,
        reason: row.reason,
        policyVersion: policy.policy_version,
        matchedRuleIndex: i,
      };
    }
  }

  return {
    modelId: policy.default_model_id,
    reason: "no policy route matched — default tier",
    policyVersion: policy.policy_version,
    matchedRuleIndex: null,
  };
}

/**
 * Safe wrapper: never throws. On error, returns default model from policy and logs via `onError`.
 */
export function selectModelSafe(
  input: SelectModelInput,
  onError?: (msg: string, ctx: Record<string, unknown>) => void,
): RouteDecision {
  try {
    return selectModel(input);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    onError?.("routing.error", { errMessage: detail });
    return {
      modelId: input.policy.default_model_id,
      reason: "router error — fell back to default_model_id",
      policyVersion: input.policy.policy_version,
      matchedRuleIndex: null,
    };
  }
}
