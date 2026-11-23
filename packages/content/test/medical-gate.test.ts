import { describe, expect, it } from "vitest";
import { canPublishForCategory, requiredReviewRolesForCategory } from "../src/workflow.js";

describe("medical / category publish gates", () => {
  it("medical needs MD + care_specialist + content_lead + lived_experience", () => {
    const r = requiredReviewRolesForCategory("medical");
    expect(r.kind).toBe("roles");
    if (r.kind === "roles") {
      expect(r.roles).toContain("medical_director");
      expect(r.roles).toContain("care_specialist");
    }
  });

  it("rejects medical publish without all roles", () => {
    const ok = canPublishForCategory("medical", [
      { reviewRole: "content_lead", verdict: "approve" },
    ]);
    expect(ok.ok).toBe(false);
  });

  it("passes when all required approves exist", () => {
    const ok = canPublishForCategory("medical", [
      { reviewRole: "content_lead", verdict: "approve" },
      { reviewRole: "medical_director", verdict: "approve" },
      { reviewRole: "care_specialist", verdict: "approve" },
      { reviewRole: "lived_experience", verdict: "approve" },
    ]);
    expect(ok.ok).toBe(true);
  });
});
