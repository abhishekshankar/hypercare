import { describe, expect, it } from "vitest";

import { defaultPolicyPath, loadPolicyFromFile } from "../src/policy.js";

describe("policy yaml typecheck (CI)", () => {
  it("parses checked-in model-routing.yaml", () => {
    const p = loadPolicyFromFile(defaultPolicyPath());
    expect(typeof p.policy_version).toBe("number");
    expect(p.routes.every((r) => r.model_id.length > 0 && r.reason.length > 0)).toBe(true);
  });
});
