export type CareProfileAxes = {
  stage: "early" | "middle" | "late" | "unknown";
  relationship: "parent" | "spouse" | "sibling" | "in_law" | "other";
  livingSituation:
    | "with_caregiver"
    | "alone"
    | "with_other_family"
    | "assisted_living"
    | "memory_care"
    | "nursing_home";
};

export type BranchRow = {
  stageKey: string;
  relationshipKey: string;
  livingSituationKey: string;
  bodyMd: string;
};

function axisMatches(branchVal: string, profileVal: string): boolean {
  return branchVal === "any" || branchVal === profileVal;
}

function branchMatchesProfile(b: BranchRow, p: CareProfileAxes): boolean {
  const stageOk = p.stage === "unknown" || b.stageKey === "any" || b.stageKey === p.stage;
  return stageOk && axisMatches(b.relationshipKey, p.relationship) && axisMatches(b.livingSituationKey, p.livingSituation);
}

/** Higher = more specific (fewer `any` axes). */
function specificity(b: BranchRow): number {
  let n = 0;
  if (b.stageKey !== "any") n++;
  if (b.relationshipKey !== "any") n++;
  if (b.livingSituationKey !== "any") n++;
  return n;
}

function branchSortKey(b: BranchRow): string {
  return `${b.stageKey}\0${b.relationshipKey}\0${b.livingSituationKey}`;
}

/**
 * Picks the best `module_branches` row for a caregiver profile (HERMES-05 subset for library read).
 */
export function selectHeavyBranchMarkdown(
  branches: readonly BranchRow[],
  profile: CareProfileAxes,
): { bodyMd: string; branch: BranchRow } {
  const matches = branches.filter((b) => branchMatchesProfile(b, profile));
  if (matches.length === 0) {
    const fallback = branches.find((b) => b.stageKey === "any" && b.relationshipKey === "any" && b.livingSituationKey === "any");
    if (fallback) {
      return { bodyMd: fallback.bodyMd, branch: fallback };
    }
    const first = branches[0];
    if (!first) {
      throw new Error("selectHeavyBranchMarkdown: no branches");
    }
    return { bodyMd: first.bodyMd, branch: first };
  }
  matches.sort((a, b) => {
    const ds = specificity(b) - specificity(a);
    if (ds !== 0) return ds;
    return branchSortKey(a).localeCompare(branchSortKey(b));
  });
  const best = matches[0]!;
  return { bodyMd: best.bodyMd, branch: best };
}
