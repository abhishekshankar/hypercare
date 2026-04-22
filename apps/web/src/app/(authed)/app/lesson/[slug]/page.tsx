import { notFound } from "next/navigation";

import { LessonExperience } from "@/components/lesson/LessonExperience";
import { loadModuleBySlug } from "@/lib/library/load-module";
import { requireSession } from "@/lib/auth/session";
import { inferStage } from "@/lib/onboarding/stage";
import type { StageAnswersRecord } from "@/lib/onboarding/stage-keys";
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
  const stage = inferStage((profile?.stageAnswers ?? {}) as StageAnswersRecord);

  return (
    <div className="space-y-6" data-testid="lesson-page">
      <LessonExperience
        crFirstName={crFirstName}
        mod={mod}
        sourceParam={sp.source ?? null}
        userStage={stage}
      />
    </div>
  );
}
