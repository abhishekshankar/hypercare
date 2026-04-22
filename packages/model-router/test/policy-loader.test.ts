import { describe, expect, it } from "vitest";

import { defaultPolicyPath, loadPolicyFromFile, parsePolicyYaml } from "../src/policy.js";

describe("parsePolicyYaml", () => {
  it("accepts a minimal valid policy", () => {
    const p = parsePolicyYaml(`
policy_version: 1
default_model_id: m-default
routes:
  - match: { topic: medical }
    model_id: m-med
    reason: "medical"
`);
    expect(p.default_model_id).toBe("m-default");
    expect(p.routes).toHaveLength(1);
  });

  it("rejects missing default_model_id", () => {
    expect(() =>
      parsePolicyYaml(`
policy_version: 1
routes: []
`),
    ).toThrow();
  });

  it("rejects unknown match keys", () => {
    expect(() =>
      parsePolicyYaml(`
policy_version: 1
default_model_id: x
routes:
  - match: { topic: medical, urgency: "high" }
    model_id: y
    reason: z
`),
    ).toThrow(/Unrecognized key|unknown match key/i);
  });

  it("rejects route with empty match keys", () => {
    expect(() =>
      parsePolicyYaml(`
policy_version: 1
default_model_id: x
routes:
  - match: {}
    model_id: y
    reason: z
`),
    ).toThrow(/at least one match key/);
  });
});

describe("bundled policy file", () => {
  it("loads default policy path", () => {
    const p = loadPolicyFromFile(defaultPolicyPath());
    expect(p.policy_version).toBeGreaterThanOrEqual(1);
    expect(p.default_model_id.length).toBeGreaterThan(0);
    expect(p.routes.length).toBeGreaterThan(0);
  });
});
