import type { AppRole } from "@hypercare/content";

export type ModuleReviewRole =
  | "content_lead"
  | "medical_director"
  | "care_specialist"
  | "caregiver_support_clinician"
  | "lived_experience"
  | "domain_sme";

export function reviewRoleForSubmit(args: { appRole: AppRole; explicit: ModuleReviewRole | undefined }):
  | { ok: true; reviewRole: ModuleReviewRole }
  | { ok: false; error: string } {
  if (args.appRole === "admin") {
    if (args.explicit == null) {
      return { ok: false, error: "admin must pass reviewRole for this action" };
    }
    return { ok: true, reviewRole: args.explicit };
  }
  if (args.explicit != null) {
    return { ok: false, error: "only admin may set explicit reviewRole" };
  }
  const r: Partial<Record<AppRole, ModuleReviewRole>> = {
    content_lead: "content_lead",
    medical_director: "medical_director",
    care_specialist: "care_specialist",
    lived_experience_reviewer: "lived_experience",
    caregiver_support_clinician: "caregiver_support_clinician",
  };
  const mapped = r[args.appRole];
  if (mapped == null) {
    return { ok: false, error: "your role may not submit this review" };
  }
  return { ok: true, reviewRole: mapped };
}
