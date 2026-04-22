"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { AboutCrFields } from "@/components/care-profile/about-cr-fields";
import { AboutYouFields } from "@/components/care-profile/about-you-fields";
import { LivingFields } from "@/components/care-profile/living-fields";
import { StageV1Fields } from "@/components/care-profile/stage-v1-fields";
import { WhatMattersFields } from "@/components/care-profile/what-matters-fields";
import { SectionPanel } from "@/components/profile/SectionPanel";
import {
  parseStep1Form,
  parseStep2Form,
  parseStep3Form,
  parseStep4Form,
  parseStep5Form,
} from "@/lib/profile/collectors";
import { redirectToLoginForNextPath } from "@/lib/profile/redirect-login";
import { fullSectionDetail, profileSectionSummaries } from "@/lib/profile/summaries";
import { flattenFieldErrors } from "@/lib/onboarding/schemas";
import type { StageV1FormDefaults } from "@/lib/onboarding/questions-v1";
import type { CareProfileRow } from "@/lib/onboarding/status";
import { getStage2DefaultsForProfile } from "@/lib/onboarding/stage2-defaults";

type Props = {
  profile: CareProfileRow;
  displayName: string;
};

async function postSection(section: string, body: unknown) {
  const res = await fetch(`/api/app/profile/section/${section}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    redirectToLoginForNextPath("/app/profile");
    return { ok: false as const, unauthorized: true };
  }
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, error: "Request failed" };
  }
  return { ok: true as const, json };
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
    />
  );
}

export function CareProfileEditor({ profile, displayName }: Props) {
  const router = useRouter();
  const [k, setK] = useState(0);
  const onSaved = useCallback(() => {
    setK((n) => n + 1);
    router.refresh();
  }, [router]);

  const sums = profileSectionSummaries(profile);
  const stageDefaults = getStage2DefaultsForProfile(profile);

  return (
    <div className="space-y-4" key={k}>
      <SectionPanel
        detail={fullSectionDetail("about", profile, displayName)}
        id="about_cr"
        summary={sums.about}
        title="About the person"
      >
        {({ setEditing }) => (
          <EditAbout
            onCancel={() => setEditing(false)}
            onSaved={() => {
              onSaved();
              setEditing(false);
            }}
            profile={profile}
          />
        )}
      </SectionPanel>

      <SectionPanel
        detail={fullSectionDetail("stage", profile, displayName)}
        id="stage"
        summary={sums.stage}
        title="Day-to-day (stage signals)"
      >
        {({ setEditing }) => (
          <EditStage
            crFirstName={profile.crFirstName}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              onSaved();
              setEditing(false);
            }}
            stageDefaults={stageDefaults}
          />
        )}
      </SectionPanel>

      <SectionPanel
        detail={fullSectionDetail("living", profile, displayName)}
        id="living"
        summary={sums.living}
        title="Living situation"
      >
        {({ setEditing }) => (
          <EditLiving
            onCancel={() => setEditing(false)}
            onSaved={() => {
              onSaved();
              setEditing(false);
            }}
            profile={profile}
          />
        )}
      </SectionPanel>

      <SectionPanel
        detail={fullSectionDetail("aboutYou", profile, displayName)}
        id="about_you"
        summary={sums.aboutYou}
        title="About you"
      >
        {({ setEditing }) => (
          <EditAboutYou
            displayName={displayName}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              onSaved();
              setEditing(false);
            }}
            profile={profile}
          />
        )}
      </SectionPanel>

      <SectionPanel
        detail={fullSectionDetail("whatMatters", profile, displayName)}
        id="what_matters"
        summary={sums.whatMatters}
        title={`What matters to ${profile.crFirstName?.trim() || "them"}`}
      >
        {({ setEditing }) => (
          <EditWhatMatters
            crFirstName={profile.crFirstName}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              onSaved();
              setEditing(false);
            }}
            profile={profile}
          />
        )}
      </SectionPanel>
    </div>
  );
}

function EditAbout({
  profile,
  onCancel,
  onSaved,
}: {
  profile: CareProfileRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rootError, setRootError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setRootError(null);
        const fd = new FormData(e.currentTarget);
        const parsed = parseStep1Form(fd);
        if (!parsed.success) {
          setErrors(flattenFieldErrors(parsed.error));
          return;
        }
        setErrors({});
        setPending(true);
        const r = await postSection("about_cr", parsed.data);
        setPending(false);
        if (r.unauthorized) {
          return;
        }
        if (!r.ok) {
          setRootError("Could not save. Try again.");
          return;
        }
        onSaved();
      }}
    >
      <AboutCrFields
        defaults={{
          crFirstName: profile.crFirstName,
          crAge: profile.crAge,
          crRelationship: profile.crRelationship,
          crDiagnosis: profile.crDiagnosis,
          crDiagnosisYear: profile.crDiagnosisYear,
        }}
        errors={errors}
        idPrefix="pf-ab-"
        pending={pending}
      />
      {rootError ? <p className="mt-2 text-sm text-destructive">{rootError}</p> : null}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {pending ? <Spinner /> : null}
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          disabled={pending}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditStage({
  crFirstName,
  stageDefaults,
  onCancel,
  onSaved,
}: {
  crFirstName: string;
  stageDefaults: StageV1FormDefaults;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rootError, setRootError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setRootError(null);
        const fd = new FormData(e.currentTarget);
        const parsed = parseStep2Form(fd);
        if (!parsed.success) {
          setErrors(flattenFieldErrors(parsed.error));
          return;
        }
        setErrors({});
        setPending(true);
        const r = await postSection("stage", parsed.data);
        setPending(false);
        if (r.unauthorized) {
          return;
        }
        if (!r.ok) {
          setRootError("Could not save. Try again.");
          return;
        }
        onSaved();
      }}
    >
      <StageV1Fields
        crFirstName={crFirstName}
        defaults={stageDefaults}
        errors={errors}
        idPrefix="pf-st-"
        pending={pending}
      />
      {rootError ? <p className="mt-2 text-sm text-destructive">{rootError}</p> : null}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {pending ? <Spinner /> : null}
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          disabled={pending}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditLiving({
  profile,
  onCancel,
  onSaved,
}: {
  profile: CareProfileRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rootError, setRootError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setRootError(null);
        const fd = new FormData(e.currentTarget);
        const parsed = parseStep3Form(fd);
        if (!parsed.success) {
          setErrors(flattenFieldErrors(parsed.error));
          return;
        }
        setErrors({});
        setPending(true);
        const r = await postSection("living", parsed.data);
        setPending(false);
        if (r.unauthorized) {
          return;
        }
        if (!r.ok) {
          setRootError("Could not save. Try again.");
          return;
        }
        onSaved();
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
        idPrefix="pf-lv-"
        pending={pending}
      />
      {rootError ? <p className="mt-2 text-sm text-destructive">{rootError}</p> : null}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {pending ? <Spinner /> : null}
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          disabled={pending}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditAboutYou({
  profile,
  displayName,
  onCancel,
  onSaved,
}: {
  profile: CareProfileRow;
  displayName: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rootError, setRootError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setRootError(null);
        const fd = new FormData(e.currentTarget);
        const parsed = parseStep4Form(fd);
        if (!parsed.success) {
          setErrors(flattenFieldErrors(parsed.error));
          return;
        }
        setErrors({});
        setPending(true);
        const r = await postSection("about_you", parsed.data);
        setPending(false);
        if (r.unauthorized) {
          return;
        }
        if (!r.ok) {
          setRootError("Could not save. Try again.");
          return;
        }
        onSaved();
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
        idPrefix="pf-ay-"
        pending={pending}
      />
      {rootError ? <p className="mt-2 text-sm text-destructive">{rootError}</p> : null}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {pending ? <Spinner /> : null}
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          disabled={pending}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditWhatMatters({
  crFirstName,
  profile,
  onCancel,
  onSaved,
}: {
  crFirstName: string;
  profile: CareProfileRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rootError, setRootError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setRootError(null);
        const fd = new FormData(e.currentTarget);
        const parsed = parseStep5Form(fd);
        if (!parsed.success) {
          setErrors(flattenFieldErrors(parsed.error));
          return;
        }
        setErrors({});
        setPending(true);
        const r = await postSection("what_matters", parsed.data);
        setPending(false);
        if (r.unauthorized) {
          return;
        }
        if (!r.ok) {
          setRootError("Could not save. Try again.");
          return;
        }
        onSaved();
      }}
    >
      <WhatMattersFields
        crFirstName={crFirstName}
        defaults={{
          crBackground: profile.crBackground,
          crJoy: profile.crJoy,
          crPersonalityNotes: profile.crPersonalityNotes,
        }}
        errors={errors}
        idPrefix="pf-wm-"
        pending={pending}
      />
      {rootError ? <p className="mt-2 text-sm text-destructive">{rootError}</p> : null}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {pending ? <Spinner /> : null}
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          disabled={pending}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
