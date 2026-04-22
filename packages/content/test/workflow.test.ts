import { describe, expect, it } from "vitest";
import {
  isDraftStatus,
  validateTransitionRequest,
} from "../src/workflow.js";
import type { AppRole } from "../src/app-role.js";

function role(s: string): AppRole {
  return s as AppRole;
}

describe("workflow transitions", () => {
  it("allows draft -> content_lead_review for content_writer", () => {
    const err = validateTransitionRequest({
      from: "draft",
      to: "content_lead_review",
      userRole: role("content_writer"),
      evidenceCount: 0,
      reason: null,
    });
    expect(err).toBeNull();
  });

  it("blocks content_lead_review -> expert_review without evidence", () => {
    const err = validateTransitionRequest({
      from: "content_lead_review",
      to: "expert_review",
      userRole: role("content_lead"),
      evidenceCount: 0,
      reason: null,
    });
    expect(err).toMatch(/evidence/);
  });

  it("requires reason when returning to draft", () => {
    const err = validateTransitionRequest({
      from: "expert_review",
      to: "draft",
      userRole: role("content_lead"),
      evidenceCount: 0,
      reason: null,
    });
    expect(err).toMatch(/reason/);
  });
});

describe("isDraftStatus", () => {
  it("rejects random strings", () => {
    expect(isDraftStatus("nope")).toBe(false);
  });
});
