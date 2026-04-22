import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { hasOnboardingAck } from "@/lib/onboarding/ack";
import { greetingForLocalHour } from "@/lib/greeting";
import {
  getFirstIncompleteStep,
  hasCompletedOnboarding,
  isWizardDataCompleteFromSnapshot,
  loadProfileBundle,
} from "@/lib/onboarding/status";
import { inferStage } from "@/lib/onboarding/stage";
import type { StageAnswersRecord } from "@/lib/onboarding/stage-keys";
import { startersForStage } from "@/lib/conversation/starters";
import { loadRecentConversations } from "@/lib/conversation/load";
import { HomeAsk } from "@/components/home/StarterChips";
import { RecentConversations } from "@/components/home/RecentConversations";

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
  const recent = await loadRecentConversations(session.userId, 5);

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <p className="text-base text-foreground">
          {greet}, {displayName}.
        </p>
        <p className="text-base text-foreground">Caring for {crName}.</p>
      </header>
      <HomeAsk starters={starters} />
      <RecentConversations items={recent} />
    </div>
  );
}
