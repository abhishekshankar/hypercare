export type BranchAxes = {
  stageKey: string;
  relationshipKey: string;
  livingSituationKey: string;
};

const STAGE: Record<string, string> = {
  early: "early-stage",
  middle: "middle-stage",
  late: "late-stage",
  any: "any stage",
};

const REL: Record<string, string> = {
  parent: "parent caring for their family member",
  spouse: "spouse or partner",
  sibling: "sibling",
  in_law: "in-law family member",
  other: "other family caregiver",
  any: "any relationship",
};

const LIV: Record<string, string> = {
  with_caregiver: "lives with the person they care for",
  alone: "whose person lives alone",
  with_other_family: "living with other family",
  assisted_living: "with someone in assisted living",
  memory_care: "with someone in memory care",
  nursing_home: "with someone in a nursing home",
  any: "any living situation",
};

export function branchKeyFromAxes(a: BranchAxes): string {
  return `${a.stageKey}|${a.relationshipKey}|${a.livingSituationKey}`;
}

export function parseBranchKeyParam(key: string): BranchAxes | null {
  const parts = key.split("|");
  if (parts.length !== 3) return null;
  return { stageKey: parts[0]!, relationshipKey: parts[1]!, livingSituationKey: parts[2]! };
}

export function humanizeBranchAxes(a: BranchAxes): string {
  const stage = STAGE[a.stageKey] ?? a.stageKey;
  const rel = REL[a.relationshipKey] ?? a.relationshipKey.replace(/_/g, " ");
  const liv = LIV[a.livingSituationKey] ?? a.livingSituationKey.replace(/_/g, " ");
  return `${stage} ${rel}, ${liv}`;
}

export function tailoredPillLine(a: BranchAxes): string {
  return `This page is tailored for: ${humanizeBranchAxes(a)}.`;
}
