import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Step1Form } from "@/components/onboarding/step-1-form";
import { Step2Form } from "@/components/onboarding/step-2-form";
import { Step3Form } from "@/components/onboarding/step-3-form";
import { Step4Form } from "@/components/onboarding/step-4-form";
import { Step5Form } from "@/components/onboarding/step-5-form";
import { OnboardingMicrocopy } from "@/components/onboarding/onboarding-microcopy";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { requireSession } from "@/lib/auth/session";
import { assertOnboardingStepAllowed } from "@/lib/onboarding/guards";
import { loadProfileBundle } from "@/lib/onboarding/status";
import type { StageAnswersRecord } from "@/lib/onboarding/stage-keys";

type Props = {
  params: Promise<{ step: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { step: raw } = await params;
  const n = Number.parseInt(raw, 10);
  const title =
    n >= 1 && n <= 5 ? `Onboarding — step ${n}` : "Onboarding";
  return { title };
}

export default async function OnboardingStepPage({ params }: Props) {
  const { step: raw } = await params;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    redirect("/onboarding/step/1");
  }

  await assertOnboardingStepAllowed(n);

  const session = await requireSession();
  const { user, profile } = await loadProfileBundle(session.userId);

  if (n === 2 && (!profile?.crFirstName?.trim() || !profile?.crRelationship)) {
    redirect("/onboarding/step/1");
  }

  return (
    <>
      <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">
        {n === 1
          ? "About the person you care for"
          : n === 2
            ? "A few questions about their day-to-day"
            : n === 3
              ? "Living and care situation"
              : n === 4
                ? "About you"
                : "What matters to them"}
      </h1>
      <OnboardingProgress step={n} />
      <OnboardingMicrocopy />

      {n === 1 ? (
        <Step1Form
          defaults={{
            crFirstName: profile?.crFirstName ?? "",
            crAge: profile?.crAge ?? null,
            crRelationship: profile?.crRelationship ?? "parent",
            crDiagnosis: profile?.crDiagnosis ?? null,
            crDiagnosisYear: profile?.crDiagnosisYear ?? null,
          }}
        />
      ) : null}

      {n === 2 ? (
        <Step2Form
          crFirstName={profile?.crFirstName ?? ""}
          defaults={(profile?.stageAnswers as StageAnswersRecord | null) ?? {}}
        />
      ) : null}

      {n === 3 ? (
        <Step3Form
          defaults={{
            livingSituation: profile?.livingSituation ?? null,
            careNetwork: profile?.careNetwork ?? null,
            careHoursPerWeek: profile?.careHoursPerWeek ?? null,
            caregiverProximity: profile?.caregiverProximity ?? null,
          }}
        />
      ) : null}

      {n === 4 ? (
        <Step4Form
          defaults={{
            displayName: user.displayName ?? "",
            caregiverAgeBracket: profile?.caregiverAgeBracket ?? null,
            caregiverWorkStatus: profile?.caregiverWorkStatus ?? null,
            caregiverState1_5: profile?.caregiverState1_5 ?? null,
            hardestThing: profile?.hardestThing ?? null,
          }}
        />
      ) : null}

      {n === 5 ? (
        <Step5Form
          crFirstName={profile?.crFirstName ?? ""}
          defaults={{
            crBackground: profile?.crBackground ?? null,
            crJoy: profile?.crJoy ?? null,
            crPersonalityNotes: profile?.crPersonalityNotes ?? null,
          }}
        />
      ) : null}
    </>
  );
}
