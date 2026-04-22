"use client";

type Defaults = {
  crBackground: string | null;
  crJoy: string | null;
  crPersonalityNotes: string | null;
};

type Props = {
  crFirstName: string;
  defaults: Defaults;
  errors: Record<string, string>;
  pending: boolean;
  idPrefix?: string;
};

export function WhatMattersFields({ crFirstName, defaults, errors, pending, idPrefix = "" }: Props) {
  const name = crFirstName.trim().length > 0 ? crFirstName.trim() : "them";
  const p = (s: string) => `${idPrefix}${s}`;

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor={p("field-cr_background")}>
          What did {name} do for work, or what were they known for?{" "}
          <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          aria-describedby={errors.cr_background ? p("error-cr_background") : undefined}
          aria-invalid={errors.cr_background ? true : undefined}
          className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
          defaultValue={defaults.crBackground ?? ""}
          disabled={pending}
          id={p("field-cr_background")}
          maxLength={500}
          name="cr_background"
        />
        {errors.cr_background ? (
          <p className="mt-1 text-sm text-destructive" id={p("error-cr_background")} role="alert">
            {errors.cr_background}
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor={p("field-cr_joy")}>
          What brings {name} joy, even now?{" "}
          <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          aria-describedby={errors.cr_joy ? p("error-cr_joy") : undefined}
          aria-invalid={errors.cr_joy ? true : undefined}
          className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
          defaultValue={defaults.crJoy ?? ""}
          disabled={pending}
          id={p("field-cr_joy")}
          maxLength={500}
          name="cr_joy"
        />
        {errors.cr_joy ? (
          <p className="mt-1 text-sm text-destructive" id={p("error-cr_joy")} role="alert">
            {errors.cr_joy}
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor={p("field-cr_personality_notes")}>
          Anything about {name}&apos;s personality or history that&apos;s important for me to
          understand? <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          aria-describedby={errors.cr_personality_notes ? p("error-cr_personality_notes") : undefined}
          aria-invalid={errors.cr_personality_notes ? true : undefined}
          className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
          defaultValue={defaults.crPersonalityNotes ?? ""}
          disabled={pending}
          id={p("field-cr_personality_notes")}
          maxLength={500}
          name="cr_personality_notes"
        />
        {errors.cr_personality_notes ? (
          <p
            className="mt-1 text-sm text-destructive"
            id={p("error-cr_personality_notes")}
            role="alert"
          >
            {errors.cr_personality_notes}
          </p>
        ) : null}
      </div>
    </div>
  );
}
