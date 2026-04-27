import Link from "next/link";
import { notFound } from "next/navigation";

import { ModuleArticle } from "@/components/modules/ModuleArticle";
import { getSession } from "@/lib/auth/session";
import { loadModuleBySlug } from "@/lib/library/load-module";

function labelStage(s: string): string {
  if (s === "early" || s === "middle" || s === "late") {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s;
}

export default async function ModulePage({
  params,
}: Readonly<{
  params: Promise<{ slug: string }>;
}>) {
  const { slug } = await params;
  const session = await getSession();
  const mod = await loadModuleBySlug(slug, session ? { userId: session.userId } : undefined);
  if (!mod) {
    notFound();
  }

  return (
    <div className="space-y-8" data-testid="module-page">
      <div className="space-y-3">
        <h1 className="font-serif text-3xl font-normal leading-tight tracking-tight text-foreground">
          {mod.title}
        </h1>
        <ul className="flex flex-wrap gap-2" aria-label="Module tags">
          {mod.stageRelevance.map((s) => (
            <li
              key={s}
              className="rounded-full bg-muted/80 px-2.5 py-1 text-xs text-muted-foreground"
            >
              {labelStage(s)}
            </li>
          ))}
          <li className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            {mod.categoryLabel}
          </li>
        </ul>
      </div>
      <ModuleArticle markdown={mod.bodyMd} />
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
