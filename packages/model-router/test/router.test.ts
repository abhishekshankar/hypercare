import { describe, expect, it } from "vitest";

import type { ClassifierVerdict, ModelRoutingPolicy, UserContext } from "../src/types.js";
import { ROUTING_COHORT_CONTROL, ROUTING_COHORT_TREATMENT } from "../src/types.js";
import { selectModel } from "../src/router.js";

const basePolicy: ModelRoutingPolicy = {
  policy_version: 7,
  default_model_id: "default-m",
  routes: [
    { match: { topic: "medical" }, model_id: "med-m", reason: "med" },
    { match: { topic: "medication" }, model_id: "rx-m", reason: "rx" },
    { match: { topic: "behavioral" }, model_id: "beh-m", reason: "beh" },
    { match: { is_refusal_template: true }, model_id: "haiku-m", reason: "tpl" },
  ],
};

const u: UserContext = { userId: "u1", routingCohort: ROUTING_COHORT_TREATMENT };

function verdict(partial: Partial<ClassifierVerdict>): ClassifierVerdict {
  return {
    topic: "other",
    urgency: "normal",
    stage: null,
    is_refusal_template: false,
    ...partial,
  };
}

describe("selectModel", () => {
  it("missing cohort defaults to control (safe baseline)", () => {
    const r = selectModel({
      policy: basePolicy,
      classifierVerdict: verdict({ topic: "medical" }),
      userContext: { userId: "u1", routingCohort: null },
      abCohort: null,
    });
    expect(r.modelId).toBe("default-m");
    expect(r.matchedRuleIndex).toBeNull();
  });

  it("control cohort always returns default", () => {
    const r = selectModel({
      policy: basePolicy,
      classifierVerdict: verdict({ topic: "medical" }),
      userContext: { ...u, routingCohort: ROUTING_COHORT_CONTROL },
      abCohort: ROUTING_COHORT_CONTROL,
    });
    expect(r.modelId).toBe("default-m");
    expect(r.matchedRuleIndex).toBeNull();
    expect(r.policyVersion).toBe(7);
  });

  it("treatment matches medical rule index 0", () => {
    const r = selectModel({
      policy: basePolicy,
      classifierVerdict: verdict({ topic: "medical" }),
      userContext: u,
      abCohort: ROUTING_COHORT_TREATMENT,
    });
    expect(r.modelId).toBe("med-m");
    expect(r.matchedRuleIndex).toBe(0);
  });

  it("treatment matches is_refusal_template when no earlier topic rule wins", () => {
    const r = selectModel({
      policy: basePolicy,
      classifierVerdict: verdict({ topic: "other", is_refusal_template: true }),
      userContext: u,
      abCohort: ROUTING_COHORT_TREATMENT,
    });
    expect(r.modelId).toBe("haiku-m");
    expect(r.matchedRuleIndex).toBe(3);
  });

  it("default fires when no rule matches", () => {
    const r = selectModel({
      policy: { ...basePolicy, routes: [{ match: { topic: "medical" }, model_id: "x", reason: "y" }] },
      classifierVerdict: verdict({ topic: "logistics" }),
      userContext: u,
      abCohort: ROUTING_COHORT_TREATMENT,
    });
    expect(r.modelId).toBe("default-m");
    expect(r.matchedRuleIndex).toBeNull();
  });
});
