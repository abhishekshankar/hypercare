import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { careProfile, createDbClient } from "@alongside/db";

import { ModuleHeavyBranchBar } from "@/components/library/ModuleHeavyBranchBar";
import { ModuleEvidencePanel } from "@/components/library/ModuleEvidencePanel";
import { RelatedModulesSection } from "@/components/library/RelatedModulesSection";
import { ModuleArticle } from "@/components/modules/ModuleArticle";
import { ModuleMarkdownWithCitations } from "@/components/modules/ModuleMarkdownWithCitations";
import { ModuleToolsSection } from "@/components/tools/ModuleToolsSection";
import { getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { loadModuleEvidenceForBody } from "@/lib/library/load-evidence";
import { loadModuleBySlug } from "@/lib/library/load-module";
import { loadRelatedModulesForSlug } from "@/lib/library/load-related-modules";

export default async function ModulePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { slug } = await params;
  const sp = await searchParams;
  const branchParam = typeof sp.branch === "string" ? sp.branch : null;
  const session = await getSession();
  const mod = await loadModuleBySlug(slug, {
    ...(session?.userId ? { userId: session.userId } : {}),
    branchParam,
  });
  if (!mod) {
    notFound();
  }

  const evidenceRows = await loadModuleEvidenceForBody(slug, mod.bodyMd);
  const evidenceByAnchor: Record<string, (typeof evidenceRows)[number]> = {};
  for (const r of evidenceRows) {
    const k = r.claimAnchor;
    if (k && k.length > 0) evidenceByAnchor[k] = r;
  }

  const related = await loadRelatedModulesForSlug(slug, {
    ...(session?.userId ? { userId: session.userId } : {}),
  });
  const contradicts = related.filter((e) => e.relationType === "contradicts");
  const nonContradicts = related.filter((e) => e.relationType !== "contradicts");

  let crDiagnosis: string | null = null;
  if (session?.userId) {
    const db = createDbClient(serverEnv.DATABASE_URL);
    const [cp] = await db
      .select({ crDiagnosis: careProfile.crDiagnosis })
      .from(careProfile)
      .where(eq(careProfile.userId, session.userId))
      .limit(1);
    crDiagnosis = cp?.crDiagnosis?.trim() ?? null;
  }

  return (
    <div className="space-y-8" data-testid="module-page">
      <div className="space-y-3">
        <h1 className="font-serif text-3xl font-normal leading-tight tracking-tight text-foreground">{mod.title}</h1>
        <ul className="flex flex-wrap gap-2" aria-label="Module tags">
          {mod.stageRelevance.map((s) => (
            <li
              key={s}
              className="rounded-full bg-muted/80 px-2.5 py-1 text-xs text-muted-foreground"
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </li>
          ))}
          <li className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            {mod.categoryLabel}
          </li>
        </ul>
      </div>

      <RelatedModulesSection crDiagnosis={crDiagnosis} edges={contradicts} />

      {mod.heavy && mod.pickedBranch && mod.branches.length > 0 ? (
        <ModuleHeavyBranchBar alternatives={mod.branches} picked={mod.pickedBranch} slug={mod.slug} />
      ) : null}

      <RelatedModulesSection crDiagnosis={crDiagnosis} edges={nonContradicts.filter((e) => e.relationType === "prerequisite")} />

      {evidenceRows.length > 0 ? (
        <ModuleMarkdownWithCitations evidenceByAnchor={evidenceByAnchor} markdown={mod.bodyMd} />
      ) : (
        <ModuleArticle markdown={mod.bodyMd} />
      )}

      <p className="text-sm text-muted-foreground" data-testid="module-attribution">
        {mod.attributionLine}
      </p>
      {mod.expertReviewer && mod.reviewDate ? (
        <p className="text-sm text-muted-foreground">
          Reviewed by {mod.expertReviewer} on {mod.reviewDate}.
        </p>
      ) : null}
      {mod.tryThisToday ? (
        <aside
          className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-base leading-relaxed text-foreground"
          data-testid="module-try-this-today"
        >
          <p className="text-sm font-medium text-muted-foreground">Try this today</p>
          <p className="mt-1">{mod.tryThisToday}</p>
        </aside>
      ) : null}

      <ModuleToolsSection tools={mod.tools} />

      <ModuleEvidencePanel rows={evidenceRows} />

      <RelatedModulesSection crDiagnosis={crDiagnosis} edges={nonContradicts.filter((e) => e.relationType !== "prerequisite")} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Link
          className="inline-flex justify-center rounded-md border border-accent bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="module-cta-lesson"
          href={`/app/lesson/${mod.slug}?source=library_browse`}
        >
          Take this as a 5-minute lesson
        </Link>
        <Link
          className="text-center text-sm text-accent underline-offset-2 hover:underline sm:text-left"
          href="/app/library"
        >
          Back to library
        </Link>
      </div>
    </div>
  );
}
