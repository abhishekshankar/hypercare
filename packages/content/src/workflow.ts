import type { AppRole } from "./app-role.js";
import { hasAnyRole, isPrivilegedContentRole } from "./app-role.js";

export const DRAFT_STATUSES = [
  "draft",
  "content_lead_review",
  "expert_review",
  "lived_experience_review",
  "approved",
  "published",
  "retired",
] as const;

export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export function isDraftStatus(s: string): s is DraftStatus {
  return (DRAFT_STATUSES as readonly string[]).includes(s);
}

/** Linear workflow steps. `published` is set only by the publish pipeline, not the transition table. */
const LINEAR: DraftStatus[] = [
  "draft",
  "content_lead_review",
  "expert_review",
  "lived_experience_review",
  "approved",
];

/**
 * Map module `category` (PRD §7.1) to expert review roles required before publish
 * (verdict `approve` in `module_reviews` for each).
 */
export function requiredReviewRolesForCategory(
  category: string,
):
  | { kind: "roles"; roles: readonly string[] }
  | { kind: "error"; message: string } {
  switch (category) {
    case "medical":
      return {
        kind: "roles",
        roles: [
          "content_lead",
          "medical_director",
          "care_specialist",
          "lived_experience",
        ] as const,
      };
    case "behaviors":
    case "daily_care":
    case "communication":
      return {
        kind: "roles",
        roles: ["content_lead", "care_specialist", "lived_experience"] as const,
      };
    case "caring_for_yourself":
      return {
        kind: "roles",
        roles: ["content_lead", "caregiver_support_clinician", "lived_experience"] as const,
      };
    case "legal_financial":
      return {
        kind: "roles",
        roles: ["content_lead", "domain_sme", "lived_experience"] as const,
      };
    case "transitions":
      return {
        kind: "roles",
        roles: ["content_lead", "care_specialist", "lived_experience"] as const,
      };
    default:
      return { kind: "error", message: `Unknown category: ${category}` };
  }
}

/**
 * True when every `requiredRoles` has at least one `approve` review on the row set.
 * Pass reviews as `{ reviewRole, verdict }[]`.
 */
export function hasAllRequiredApprovals(
  requiredRoles: readonly string[],
  reviews: { reviewRole: string; verdict: string }[],
): boolean {
  const approved = new Set(
    reviews.filter((r) => r.verdict === "approve").map((r) => r.reviewRole),
  );
  for (const role of requiredRoles) {
    if (!approved.has(role)) {
      return false;
    }
  }
  return true;
}

/**
 * Enforces: transition into `expert_review` only if at least one evidence row exists.
 */
export function evidenceRequiredForMoveToExpertReview(evidenceCount: number): boolean {
  return evidenceCount >= 1;
}

type TransitionContext = {
  from: DraftStatus;
  to: DraftStatus;
  userRole: AppRole;
  evidenceCount: number;
  reason: string | null;
};

/**
 * @returns `null` if allowed, otherwise an error message.
 */
export function validateTransitionRequest(ctx: TransitionContext): string | null {
  const { from, to, userRole, evidenceCount, reason } = ctx;
  if (from === to) {
    return "from and to must differ";
  }

  if (to === "draft") {
    if (!isPrivilegedContentRole(userRole)) {
      return "only content_lead or admin can move a module back to draft";
    }
    if (reason == null || reason.trim() === "") {
      return "reason is required when returning to draft";
    }
    return null;
  }

  if (to === "retired") {
    if (from !== "published") {
      return "can only retire from published state";
    }
    if (!hasAnyRole(userRole, ["content_lead", "admin"])) {
      return "forbidden: retire requires content_lead or admin";
    }
    return null;
  }

  if (to === "expert_review" && from === "content_lead_review") {
    if (!evidenceRequiredForMoveToExpertReview(evidenceCount)) {
      return "at least one evidence entry is required before expert_review";
    }
  }

  const fromIdx = LINEAR.indexOf(from);
  const toIdx = LINEAR.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) {
    return "invalid state in linear workflow";
  }
  if (toIdx !== fromIdx + 1) {
    return `illegal forward transition: ${from} → ${to}`;
  }

  if (from === "draft" && to === "content_lead_review") {
    if (!hasAnyRole(userRole, ["content_writer", "content_lead", "admin"])) {
      return "forbidden: draft → content_lead_review";
    }
    return null;
  }
  if (from === "content_lead_review" && to === "expert_review") {
    if (!hasAnyRole(userRole, ["content_lead", "admin"])) {
      return "forbidden: content_lead_review → expert_review";
    }
    return null;
  }
  if (from === "expert_review" && to === "lived_experience_review") {
    if (!hasAnyRole(userRole, ["content_lead", "admin"])) {
      return "forbidden: expert_review → lived_experience_review";
    }
    return null;
  }
  if (from === "lived_experience_review" && to === "approved") {
    if (!hasAnyRole(userRole, ["content_lead", "admin"])) {
      return "forbidden: lived_experience_review → approved";
    }
    return null;
  }
  return "transition not allowed";
}

/**
 * Publish transition is implemented via `ingest` + dedicated route; this maps `approved` → `published` after DB work.
 */
export function assertCanCallPublish(
  from: DraftStateForPublish,
  userRole: AppRole,
): void {
  if (from !== "approved") {
    throw new Error("publish requires draft_status = approved");
  }
  if (!hasAnyRole(userRole, ["content_lead", "admin"])) {
    throw new Error("forbidden: publish");
  }
}

type DraftStateForPublish = "approved";

/**
 * `domain_sme` is often satisfied by an `admin` reviewer with an explicit `domain_sme` review row.
 */
export function canPublishForCategory(
  category: string,
  reviews: { reviewRole: string; verdict: string }[],
): { ok: true } | { ok: false; message: string } {
  const req = requiredReviewRolesForCategory(category);
  if (req.kind === "error") {
    return { ok: false, message: req.message };
  }
  if (!hasAllRequiredApprovals(req.roles, reviews)) {
    return {
      ok: false,
      message: `Missing required review approvals for category ${category}`,
    };
  }
  return { ok: true };
}
