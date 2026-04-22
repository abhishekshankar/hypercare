import Link from "next/link";

import { requireSession } from "@/lib/auth/session";
import { ScreenHeader } from "@/components/screen-header";

/**
 * v0 stub for "Read the full module →" links from citation expansions.
 * Real module browse ships post-v1; this placeholder is intentionally
 * minimal so the citation UX is testable end-to-end without coupling to
 * a content browse implementation.
 */
export default async function ModuleStubPage({
  params,
}: Readonly<{
  params: Promise<{ slug: string }>;
}>) {
  await requireSession();
  const { slug } = await params;
  const human = slug
    .split(/[-/]/)
    .filter((s) => s.length > 0)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" — ");

  return (
    <div className="space-y-4" data-testid="module-stub">
      <ScreenHeader subHeadline={`Module: ${human}`} title="Full module browse coming soon" />
      <p className="text-base leading-relaxed text-foreground">
        We’ll surface the full caregiver guide for <span className="font-medium">{human}</span> in
        a future release. For now, citations on your conversations show the source heading and
        attribution inline so you know where each suggestion came from.
      </p>
      <Link
        className="inline-block text-accent underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent"
        href="/app"
      >
        ← Back to home
      </Link>
    </div>
  );
}
