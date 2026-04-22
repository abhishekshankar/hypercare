import { redirect } from "next/navigation";

import { createDbClient } from "@hypercare/db";
import { pickThisWeeksFocus } from "@hypercare/picker";

import { CheckinCard } from "@/components/home/CheckinCard";
import { HomeAsk } from "@/components/home/StarterChips";
import { RecentConversations } from "@/components/home/RecentConversations";
import { SavedLessonBanner } from "@/components/home/SavedLessonBanner";
import { ThingsToRevisit } from "@/components/home/ThingsToRevisit";
import { SuppressionCard } from "@/components/home/SuppressionCard";
import { WeeksFocusCard } from "@/components/home/WeeksFocusCard";
import { loadRecentConversations } from "@/lib/conversation/load";
import { listRecentSavesForHome } from "@/lib/saved/service";
import { startersForStage } from "@/lib/conversation/starters";
import { serverEnv } from "@/lib/env.server";
import { greetingForLocalHour } from "@/lib/greeting";
import { refineFocusSubtitle } from "@/lib/home/focus-subtitle";
import { shouldShowWeeklyCheckin } from "@/lib/home/checkin-cadence";
import { requireSession } from "@/lib/auth/session";
import { hasOnboardingAck } from "@/lib/onboarding/ack";
import {
  getFirstIncompleteStep,
  hasCompletedOnboarding,
  isWizardDataCompleteFromSnapshot,
  loadProfileBundle,
} from "@/lib/onboarding/status";
import { getSuppressionStatus } from "@/lib/safety/user-suppression";
import { inferStage } from "@/lib/onboarding/stage";
import type { StageAnswersRecord } from "@/lib/onboarding/stage-keys";

export default async function AppHomePage() {
  const session = await requireSession();
  if (!(await hasCompletedOnboarding(session.userId))) {
    const { user, profile } = await loadProfileBundle(session.userId);
    const dataDone = isWizardDataCompleteFromSnapshot(profile, user.displayName);
    if (!dataDone) {
      const step = getFirstIncompleteStep(profile, user.displayName) ?? 1;
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
  const stage = inferStage((profile?.stageAnswers ?? {}) as StageAnswersRecord);
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

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <p className="text-base text-foreground">
          {greet}, {displayName}.
        </p>
        <p className="text-base text-foreground">Caring for {crName}.</p>
      </header>
      <SavedLessonBanner />
      {suppression.active ? <SuppressionCard /> : null}
      {suppression.active ? null : <WeeksFocusCard result={focus} subtitle={focusSubtitle} />}
      {suppression.active ? null : checkin.show ? <CheckinCard /> : null}
      <HomeAsk starters={starters} />
      <RecentConversations items={recent} />
      <ThingsToRevisit items={thingsToRevisit} />
    </div>
  );
}
