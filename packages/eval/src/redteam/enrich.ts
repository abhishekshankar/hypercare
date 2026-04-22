import type { SafetyEscalationScript, SafetyTriageReason } from "@hypercare/rag";
import {
  parseEscalationFile,
  resolveScriptFilename,
  type SafetyClassifierCategory,
} from "@hypercare/safety";

export type TriageNameContext = { crName: string; caregiverName?: string };

/**
 * Same behavior as `apps/web` `enrichSafetyTriageReason` without `server-only`.
 */
export function enrichSafetyTriageReasonForEval(
  reason: SafetyTriageReason,
  userText: string,
  names: TriageNameContext,
): SafetyTriageReason & { script: SafetyEscalationScript } {
  const filename = resolveScriptFilename(reason.category as SafetyClassifierCategory, userText);
  const parseNames = {
    crName: names.crName,
    ...(names.caregiverName !== undefined ? { caregiverName: names.caregiverName } : {}),
  };
  const parsed = parseEscalationFile(
    filename,
    reason.category as SafetyClassifierCategory,
    userText,
    parseNames,
  );
  const script: SafetyEscalationScript = {
    version: parsed.version,
    reviewed_by: parsed.reviewedBy,
    reviewed_on: parsed.reviewedOn,
    next_review_due: parsed.nextReviewDue,
    direct_answer: parsed.directAnswer,
    body_md: parsed.bodyMd,
    primary_resources: parsed.primaryResources,
    ...(parsed.disclosure ? { disclosure: parsed.disclosure } : {}),
  };
  return { ...reason, script };
}
