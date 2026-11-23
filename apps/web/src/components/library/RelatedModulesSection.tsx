import Link from "next/link";

import type { RelatedEdge } from "@/lib/library/load-related-modules";

function contradictsRelevantToProfile(toSlug: string, diagnosis: string | null): boolean {
  if (!diagnosis) return false;
  const d = diagnosis.toLowerCase();
  const lewy = d.includes("lewy") || d.includes("lbd");
  if (!lewy) return false;
  return toSlug.includes("lbd") || toSlug.includes("lewy");
}

export function RelatedModulesSection({
  edges,
  crDiagnosis,
}: Readonly<{
  edges: RelatedEdge[];
  crDiagnosis: string | null;
}>) {
  const prereq = edges.filter((e) => e.relationType === "prerequisite");
  const follow = edges.filter((e) => e.relationType === "follow_up");
  const deeper = edges.filter((e) => e.relationType === "deeper");
  const contradicts = edges.filter(
    (e) => e.relationType === "contradicts" && contradictsRelevantToProfile(e.toSlug, crDiagnosis),
  );

  if (edges.length === 0) return null;

  const Block = ({
    title,
    items,
    tone,
  }: Readonly<{
    title: string;
    items: RelatedEdge[];
    tone: "default" | "warn";
  }>) =>
    items.length === 0 ? null : (
      <section className={tone === "warn" ? "rounded-lg border border-amber-600/50 bg-amber-50 px-4 py-3" : "rounded-lg border border-border bg-muted/20 px-4 py-3"}>
        <h2 className="font-serif text-lg font-medium text-foreground">{title}</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {items.map((e) => (
            <li key={`${e.relationType}-${e.toSlug}`}>
              <Link className="text-accent underline-offset-2 hover:underline" href={`/app/modules/${e.toSlug}`}>
                {e.toTitle}
              </Link>
              {e.read ? <span className="ml-2 text-xs text-muted-foreground">(read)</span> : null}
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <div className="space-y-4" data-testid="related-modules">
      <Block items={contradicts} title="Important for your situation" tone="warn" />
      <Block items={prereq} title="Read this first" tone="default" />
      <Block items={follow} title="When you are ready: read next" tone="default" />
      <Block items={deeper} title="Go deeper" tone="default" />
    </div>
  );
}
