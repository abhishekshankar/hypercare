import { redirect } from "next/navigation";

import { createDbClient } from "@alongside/db";
import { pickThisWeeksFocus } from "@alongside/picker";

import { CheckinCard } from "@/components/home/CheckinCard";
import { HomeAsk } from "@/components/home/StarterChips";
import { RecentConversations } from "@/components/home/RecentConversations";
import { SavedLessonBanner } from "@/components/home/SavedLessonBanner";
import { ThingsToRevisit } from "@/components/home/ThingsToRevisit";
import { SuppressionCard } from "@/components/home/SuppressionCard";
import { WarmCompanionCard } from "@/components/home/WarmCompanionCard";
import { WeeksFocusCard } from "@/components/home/WeeksFocusCard";
import { loadRecentConversations } from "@/lib/conversation/load";
import { listRecentSavesForHome } from "@/lib/saved/service";
import { startersForStage } from "@/lib/conversation/starters";
import { serverEnv } from "@/lib/env.server";
import { greetingForLocalHour } from "@/lib/greeting";
import { refineFocusSubtitle } from "@/lib/home/focus-subtitle";
import { shouldShowWeeklyCheckin, countSoftFlagsLast7Days } from "@/lib/home/checkin-cadence";
import { loadBurnoutWarmCompanionModule } from "@/lib/home/load-warm-companion";
import { requireSession } from "@/lib/auth/session";
import { hasOnboardingAck } from "@/lib/onboarding/ack";
import {
  displayNameForProfileWizard,
  getFirstIncompleteStep,
  hasCompletedOnboarding,
  isWizardDataCompleteFromSnapshot,
  loadProfileBundle,
} from "@/lib/onboarding/status";
import { getSuppressionStatus } from "@/lib/safety/user-suppression";
import { careProfileToStageSnapshot } from "@/lib/onboarding/care-profile-stage-snapshot";
import { inferInferredStage } from "@/lib/onboarding/stage";

export default async function AppHomePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const sp = await searchParams;
  const feedbackThanks = typeof sp.feedback === "string" && sp.feedback === "thanks";
  const lessonCancel = typeof sp.lesson_cancel === "string" && sp.lesson_cancel === "1";
  const session = await requireSession();
  if (!(await hasCompletedOnboarding(session.userId))) {
    const { user, profile, membership } = await loadProfileBundle(session.userId);
    const disp = displayNameForProfileWizard(user, membership);
    const dataDone = isWizardDataCompleteFromSnapshot(profile, disp);
    if (!dataDone) {
      const step = getFirstIncompleteStep(profile, disp) ?? 1;
      redirect(`/onboarding/step/${step}`);
    }
    const ack = await hasOnboardingAck();
    if (!ack) {
      redirect("/onboarding/summary");
    }
  }

  const { user, profile } = await loadProfileBundle(session.userId);
  const displayName = user.displayName?.trim() ?? "there";
  const crName = profile?.crFirstName?.trim() ?? "them";
  const hour = new Date().getHours();
  const greet = greetingForLocalHour(hour);
  const stage = profile ? inferInferredStage(careProfileToStageSnapshot(profile)) : null;
  const starters = startersForStage(stage);
  const [recent, thingsToRevisit] = await Promise.all([
    loadRecentConversations(session.userId, 5),
    listRecentSavesForHome(session.userId, 5),
  ]);

  const db = createDbClient(serverEnv.DATABASE_URL);
  const now = () => new Date();
  const [focus, checkin, suppression] = await Promise.all([
    pickThisWeeksFocus({ userId: session.userId }, { db, now }),
    shouldShowWeeklyCheckin(session.userId, { db, now }),
    getSuppressionStatus(session.userId, now()),
  ]);
  const focusSubtitle = refineFocusSubtitle(focus, profile?.hardestThing ?? null);

  const softBurnoutCount = await countSoftFlagsLast7Days(session.userId, { db, now });
  const warmCompanion =
    !suppression.active && softBurnoutCount >= 2 ? await loadBurnoutWarmCompanionModule() : null;

  return (
    <div className="space-y-10">
      {feedbackThanks ? (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          role="status"
        >
          Thanks — we read every one of these.
        </p>
      ) : null}
      {lessonCancel ? (
        <p
          className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
          data-testid="lesson-cancel-toast"
          role="status"
        >
          Lesson cancelled.
        </p>
      ) : null}
      <header className="space-y-2 border-b border-border pb-8">
        <p className="along-eyebrow">Today</p>
        <p className="font-serif text-2xl font-normal text-foreground md:text-3xl">
          {greet}, {displayName}.
        </p>
        <p className="text-base text-foreground-muted">Caring for {crName}.</p>
      </header>
      <SavedLessonBanner />
      {suppression.active ? <SuppressionCard /> : null}
      {suppression.active ? null : <WeeksFocusCard result={focus} subtitle={focusSubtitle} />}
      {suppression.active ? null : warmCompanion ? (
        <WarmCompanionCard
          slug={warmCompanion.slug}
          title={warmCompanion.title}
          tryThisToday={warmCompanion.tryThisToday}
        />
      ) : null}
      {suppression.active ? null : checkin.show ? <CheckinCard /> : null}
      <HomeAsk starters={starters} />
      <RecentConversations items={recent} />
      <ThingsToRevisit items={thingsToRevisit} />
    </div>
  );
}
