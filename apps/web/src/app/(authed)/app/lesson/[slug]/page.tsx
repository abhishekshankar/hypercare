import { notFound } from "next/navigation";

import { createDbClient } from "@alongside/db";
import { pickThisWeeksFocus } from "@alongside/picker";

import { LessonExperience } from "@/components/lesson/LessonExperience";
import { loadModuleBySlug } from "@/lib/library/load-module";
import { requireSession } from "@/lib/auth/session";
import { serverEnv, streamingLessonsEnabled } from "@/lib/env.server";
import { careProfileToStageSnapshot } from "@/lib/onboarding/care-profile-stage-snapshot";
import { inferInferredStage } from "@/lib/onboarding/stage";
import { loadProfileBundle } from "@/lib/onboarding/status";

export default async function LessonPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ source?: string }>;
}>) {
  const session = await requireSession();
  const { slug } = await params;
  const sp = await searchParams;
  const mod = await loadModuleBySlug(slug);
  if (!mod) {
    notFound();
  }
  const { profile } = await loadProfileBundle(session.userId);
  const crFirstName = profile?.crFirstName?.trim() ?? null;
  const stage = profile ? inferInferredStage(careProfileToStageSnapshot(profile)) : null;

  const publicStreamLessons =
    process.env.NEXT_PUBLIC_STREAMING_LESSONS === "1" ||
    process.env.NEXT_PUBLIC_STREAMING_LESSONS === "true";
  const lessonStreamEnabled = streamingLessonsEnabled() && publicStreamLessons;

  const db = createDbClient(serverEnv.DATABASE_URL);
  const focus = await pickThisWeeksFocus(
    { userId: session.userId },
    { db, now: () => new Date() },
  );
  let reviewHint: string | null = null;
  if (
    focus.kind === "pick" &&
    focus.slug === slug &&
    "reviewResurface" in focus &&
    focus.reviewResurface != null
  ) {
    const d = focus.reviewResurface.lastSeenDaysAgo;
    reviewHint = `Last seen ${String(d)} day${d === 1 ? "" : "s"} ago — due for a quick review.`;
  }

  return (
    <div className="space-y-6">
      <LessonExperience
        crFirstName={crFirstName}
        lessonStreamEnabled={lessonStreamEnabled}
        mod={lessonStreamEnabled ? null : mod}
        reviewHint={reviewHint}
        slug={slug}
        sourceParam={sp.source ?? null}
        userStage={stage}
      />
    </div>
  );
}
