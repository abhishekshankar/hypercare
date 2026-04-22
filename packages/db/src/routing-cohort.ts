import { createHash } from "node:crypto";

import { ROUTING_COHORT_CONTROL, ROUTING_COHORT_TREATMENT } from "@hypercare/model-router";

export type { RoutingCohortId } from "@hypercare/model-router";

/**
 * Must match `0021_model_routing.sql` backfill:
 * `get_byte(sha256(convert_to(id::text, 'UTF8')), 0) % 2`.
 */
export function routingCohortFromUserId(userId: string): typeof ROUTING_COHORT_CONTROL | typeof ROUTING_COHORT_TREATMENT {
  const b = createHash("sha256").update(userId, "utf8").digest()[0]!;
  return b % 2 === 0 ? ROUTING_COHORT_CONTROL : ROUTING_COHORT_TREATMENT;
}
