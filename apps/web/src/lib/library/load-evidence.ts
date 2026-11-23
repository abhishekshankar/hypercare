import { and, asc, eq, inArray } from "drizzle-orm";
import { createDbClient, moduleEvidence, modules } from "@alongside/db";

import { serverEnv } from "@/lib/env.server";

export type ModuleEvidenceRow = {
  id: string;
  claimAnchor: string | null;
  citation: string;
  sourceTier: number;
  sourceType: string;
  url: string | null;
  quotedExcerpt: string | null;
  urlSnapshot: string | null;
  addedAt: string;
};

function claimAnchorsInMarkdown(bodyMd: string): string[] {
  const re = /\[(\d+)\]/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyMd)) !== null) {
    out.add(`[${m[1]!}]`);
  }
  return [...out];
}

export async function loadModuleEvidenceForBody(
  moduleSlug: string,
  bodyMd: string,
): Promise<ModuleEvidenceRow[]> {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [m] = await db.select({ id: modules.id }).from(modules).where(eq(modules.slug, moduleSlug)).limit(1);
  if (!m) return [];
  const anchors = claimAnchorsInMarkdown(bodyMd);
  if (anchors.length === 0) return [];

  const rows = await db
    .select({
      id: moduleEvidence.id,
      claimAnchor: moduleEvidence.claimAnchor,
      citation: moduleEvidence.citation,
      sourceTier: moduleEvidence.sourceTier,
      sourceType: moduleEvidence.sourceType,
      url: moduleEvidence.url,
      quotedExcerpt: moduleEvidence.quotedExcerpt,
      urlSnapshot: moduleEvidence.urlSnapshot,
      addedAt: moduleEvidence.addedAt,
    })
    .from(moduleEvidence)
    .where(and(eq(moduleEvidence.moduleId, m.id), inArray(moduleEvidence.claimAnchor, anchors)))
    .orderBy(asc(moduleEvidence.sourceTier), asc(moduleEvidence.claimAnchor));

  return rows.map((r) => ({
    id: r.id,
    claimAnchor: r.claimAnchor,
    citation: r.citation,
    sourceTier: r.sourceTier,
    sourceType: r.sourceType,
    url: r.url,
    quotedExcerpt: r.quotedExcerpt,
    urlSnapshot: r.urlSnapshot,
    addedAt:
      typeof r.addedAt === "string"
        ? r.addedAt
        : r.addedAt instanceof Date
          ? r.addedAt.toISOString()
          : "",
  }));
}
