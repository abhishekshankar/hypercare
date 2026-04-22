"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";

import { AboutYouFields } from "@/components/care-profile/about-you-fields";
import { LivingFields } from "@/components/care-profile/living-fields";
import { StageFields } from "@/components/care-profile/stage-fields";
import { ScreenHeader } from "@/components/screen-header";
import { parseStep2Form, parseStep3Form, parseStep4Form } from "@/lib/profile/collectors";
import { redirectToLoginForNextPath } from "@/lib/profile/redirect-login";
import { flattenFieldErrors, type Step2Input, type Step3Input, type Step4Input } from "@/lib/onboarding/schemas";
import type { CareProfileRow } from "@/lib/onboarding/status";
import type { StageAnswersRecord } from "@/lib/onboarding/stage-keys";

type Props = {
  profile: CareProfileRow;
  displayName: string;
};

type Err = { ok: false; errors: z.ZodError };
type OkR = { ok: true };
type R = OkR | Err;

export function ChangedFlow({ profile, displayName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [rootError, setRootError] = useState<string | null>(null);
  const [elseText, setElseText] = useState("");

  const [includeStage, setIncludeStage] = useState(false);
  const [includeLiving, setIncludeLiving] = useState(false);
  const [includeAbout, setIncludeAbout] = useState(false);
  const [stageData, setStageData] = useState<Step2Input | null>(null);
  const [livingData, setLivingData] = useState<Step3Input | null>(null);
  const [aboutData, setAboutData] = useState<Step4Input | null>(null);

  const stageDefaults = (profile.stageAnswers ?? {}) as StageAnswersRecord;

  async function postFinal() {
    setRootError(null);
    const body: Record<string, unknown> = {};
    if (includeStage && stageData != null) {
      body.stage = stageData;
    }
    if (includeLiving && livingData != null) {
      body.living = livingData;
    }
    if (includeAbout && aboutData != null) {
      body.about_you = aboutData;
    }
    if (elseText.trim() !== "") {
      body.anything_else = elseText.trim();
    }
    const hasAny = Object.keys(body).length > 0;
    if (!hasAny) {
      router.push("/app/profile");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/app/profile/changed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      redirectToLoginForNextPath("/app/profile/changed");
      return;
    }
    if (!res.ok) {
      setRootError("We couldn’t save. Try again.");
      setSaving(false);
      return;
    }
    const json = (await res.json()) as { ok?: boolean; changedFields?: string[] };
    setSaving(false);
    if (Array.isArray(json.changedFields) && json.changedFields.length > 0) {
      router.push("/app/profile?saved=1");
    } else {
      router.push("/app/profile");
    }
  }

  return (
    <div className="space-y-6">
      <ScreenHeader
        subHeadline="Answer only what’s different — the rest of your profile stays the same until you change it here."
        title="My situation has changed"
      />
      <p className="text-sm text-muted-foreground">Step {step} of 4</p>
      {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}

      {step === 1 ? (
        <Step1Stage
          crFirstName={profile.crFirstName}
          onContinue={(fd) => {
            const p = parseStep2Form(fd);
            if (!p.success) {
              return { ok: false, errors: p.error };
            }
            setStageData(p.data);
            setIncludeStage(true);
            setStep(2);
            return { ok: true };
          }}
          onSkip={() => {
            setIncludeStage(false);
            setStageData(null);
            setStep(2);
          }}
          stageDefaults={stageDefaults}
        />
      ) : null}

      {step === 2 ? (
        <Step2Living
          onBack={() => setStep(1)}
          onContinue={(fd) => {
            const p = parseStep3Form(fd);
            if (!p.success) {
              return { ok: false, errors: p.error };
            }
            setLivingData(p.data);
            setIncludeLiving(true);
            setStep(3);
            return { ok: true };
          }}
          onSkip={() => {
            setIncludeLiving(false);
            setLivingData(null);
            setStep(3);
          }}
          profile={profile}
        />
      ) : null}

      {step === 3 ? (
        <Step3About
          displayName={displayName}
          onBack={() => setStep(2)}
          onContinue={(fd) => {
            const p = parseStep4Form(fd);
            if (!p.success) {
              return { ok: false, errors: p.error };
            }
            setAboutData(p.data);
            setIncludeAbout(true);
            setStep(4);
            return { ok: true };
          }}
          onSkip={() => {
            setIncludeAbout(false);
            setAboutData(null);
            setStep(4);
          }}
          profile={profile}
        />
      ) : null}

      {step === 4 ? (
        <Step4Anything
          disabled={saving}
          elseText={elseText}
          onBack={() => setStep(3)}
          onSave={() => void postFinal()}
          onSkip={() => void postFinal()}
          setElseText={setElseText}
        />
      ) : null}
    </div>
  );
}

function Step1Stage({
  crFirstName,
  stageDefaults,
  onContinue,
  onSkip,
}: {
  crFirstName: string;
  stageDefaults: StageAnswersRecord;
  onContinue: (fd: FormData) => R;
  onSkip: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      className="space-y-6"
      data-testid="changed-step-1"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = onContinue(new FormData(e.currentTarget));
        if (!r.ok) {
          setErrors(flattenFieldErrors(r.errors));
        } else {
          setErrors({});
        }
      }}
    >
      <StageFields
        crFirstName={crFirstName}
        defaults={stageDefaults}
        errors={errors}
        idPrefix="ch-st-"
        pending={false}
      />
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          type="submit"
        >
          Continue
        </button>
        <button
          className="text-sm text-muted-foreground underline"
          onClick={onSkip}
          type="button"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}

function Step2Living({
  profile,
  onBack,
  onContinue,
  onSkip,
}: {
  profile: CareProfileRow;
  onBack: () => void;
  onContinue: (fd: FormData) => R;
  onSkip: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const r = onContinue(new FormData(e.currentTarget));
        if (!r.ok) {
          setErrors(flattenFieldErrors(r.errors));
        } else {
          setErrors({});
        }
      }}
    >
      <LivingFields
        defaults={{
          livingSituation: profile.livingSituation,
          careNetwork: profile.careNetwork,
          careHoursPerWeek: profile.careHoursPerWeek,
          caregiverProximity: profile.caregiverProximity,
        }}
        errors={errors}
        idPrefix="ch-lv-"
        pending={false}
      />
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="text-sm" onClick={onBack} type="button">
          Back
        </button>
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          type="submit"
        >
          Continue
        </button>
        <button
          className="text-sm text-muted-foreground underline"
          onClick={onSkip}
          type="button"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}

function Step3About({
  profile,
  displayName,
  onBack,
  onContinue,
  onSkip,
}: {
  profile: CareProfileRow;
  displayName: string;
  onBack: () => void;
  onContinue: (fd: FormData) => R;
  onSkip: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const r = onContinue(new FormData(e.currentTarget));
        if (!r.ok) {
          setErrors(flattenFieldErrors(r.errors));
        } else {
          setErrors({});
        }
      }}
    >
      <AboutYouFields
        defaults={{
          displayName,
          caregiverAgeBracket: profile.caregiverAgeBracket,
          caregiverWorkStatus: profile.caregiverWorkStatus,
          caregiverState1_5: profile.caregiverState1_5,
          hardestThing: profile.hardestThing,
        }}
        errors={errors}
        idPrefix="ch-ay-"
        pending={false}
      />
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="text-sm" onClick={onBack} type="button">
          Back
        </button>
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          type="submit"
        >
          Continue
        </button>
        <button
          className="text-sm text-muted-foreground underline"
          onClick={onSkip}
          type="button"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}

function Step4Anything({
  elseText,
  setElseText,
  onBack,
  onSave,
  onSkip,
  disabled,
}: {
  elseText: string;
  setElseText: (s: string) => void;
  onBack: () => void;
  onSave: () => void;
  onSkip: () => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4" data-testid="changed-step-4">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="anything_else_w">
          What&apos;s new that I should know?{" "}
          <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          id="anything_else_w"
          maxLength={500}
          onChange={(e) => setElseText(e.target.value)}
          value={elseText}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        This is added to the “personality and history” notes; it helps when your situation shifts.
      </p>
      <div className="flex flex-wrap gap-3">
        <button className="text-sm" disabled={disabled} onClick={onBack} type="button">
          Back
        </button>
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          disabled={disabled}
          onClick={onSave}
          type="button"
        >
          {disabled ? "Saving…" : "Save and return to profile"}
        </button>
        <button
          className="text-sm text-muted-foreground underline"
          disabled={disabled}
          onClick={onSkip}
          type="button"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
