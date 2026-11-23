"use client";

import { useCallback, useState } from "react";

import { ALONE_SAFETY_OPTIONS, STAGE_V1_TEXT, type StageV1FormDefaults } from "@/lib/onboarding/questions-v1";
import type { AloneSafetyChip } from "@alongside/content/stage-rules";

type Props = {
  crFirstName: string;
  defaults: StageV1FormDefaults;
  errors: Record<string, string>;
  pending: boolean;
  idPrefix?: string;
};

function aloneToggle(
  set: Set<AloneSafetyChip>,
  value: AloneSafetyChip,
  checked: boolean,
): Set<AloneSafetyChip> {
  const next = new Set(set);
  if (value === "nothing") {
    if (checked) {
      return new Set<AloneSafetyChip>(["nothing"]);
    }
    next.delete("nothing");
    return next;
  }
  if (checked) {
    next.delete("nothing");
    next.add(value);
  } else {
    next.delete(value);
  }
  return next;
}

export function StageV1Fields({ crFirstName, defaults, errors, pending, idPrefix = "" }: Props) {
  const name = crFirstName.trim().length > 0 ? crFirstName.trim() : "they";
  const p = (s: string) => `${idPrefix}${s}`;

  const initialAlone = new Set<AloneSafetyChip>(defaults.alone_safety_v1 ?? []);
  const [alone, setAlone] = useState<Set<AloneSafetyChip>>(initialAlone);

  const onChip = useCallback(
    (value: AloneSafetyChip, checked: boolean) => {
      setAlone((prev) => aloneToggle(new Set(prev), value, checked));
    },
    [],
  );

  return (
    <div className="space-y-8">
      <StageRadioBlock
        error={errors.med_management_v1}
        idPrefix={p("med_management_v1-")}
        legend={STAGE_V1_TEXT.med(name)}
        name="med_management_v1"
        options={STAGE_V1_TEXT.medOptions}
        pending={pending}
        value={defaults.med_management_v1}
      />

      <StageRadioBlock
        error={errors.driving_v1}
        idPrefix={p("driving_v1-")}
        legend={STAGE_V1_TEXT.driving(name)}
        name="driving_v1"
        options={STAGE_V1_TEXT.drivingOptions}
        pending={pending}
        value={defaults.driving_v1}
      />

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-foreground">
          {STAGE_V1_TEXT.alone(name)}
        </legend>
        <ul
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Safety worries when alone"
        >
          {ALONE_SAFETY_OPTIONS.map(({ value, label }) => {
            const on = alone.has(value);
            return (
              <li key={value}>
                <label
                  className={`inline-flex cursor-pointer select-none items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    on
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-input bg-background text-foreground"
                  } ${pending ? "opacity-60" : ""}`}
                >
                  <input
                    checked={on}
                    className="sr-only"
                    disabled={pending}
                    name="alone_safety_v1"
                    onChange={(e) => onChip(value, e.target.checked)}
                    type="checkbox"
                    value={value}
                  />
                  {label}
                </label>
              </li>
            );
          })}
        </ul>
        {errors.alone_safety_v1 ? (
          <p className="text-sm text-destructive" id={p("error-alone")} role="alert">
            {errors.alone_safety_v1}
          </p>
        ) : null}
      </fieldset>

      <StageRadioBlock
        error={errors.recognition_v1}
        idPrefix={p("recognition_v1-")}
        legend={STAGE_V1_TEXT.recognition(name)}
        name="recognition_v1"
        options={STAGE_V1_TEXT.recognitionOptions}
        pending={pending}
        value={defaults.recognition_v1}
      />

      <StageRadioBlock
        error={errors.bathing_dressing_v1}
        idPrefix={p("bathing_dressing_v1-")}
        legend={STAGE_V1_TEXT.bathing(name)}
        name="bathing_dressing_v1"
        options={STAGE_V1_TEXT.bathingOptions}
        pending={pending}
        value={defaults.bathing_dressing_v1}
      />

      <StageRadioBlock
        error={errors.wandering_v1}
        idPrefix={p("wandering_v1-")}
        legend={STAGE_V1_TEXT.wandering(name)}
        name="wandering_v1"
        options={STAGE_V1_TEXT.wanderingOptions}
        pending={pending}
        value={defaults.wandering_v1}
      />

      <StageRadioBlock
        error={errors.conversation_v1}
        idPrefix={p("conversation_v1-")}
        legend={STAGE_V1_TEXT.conversation(name)}
        name="conversation_v1"
        options={STAGE_V1_TEXT.conversationOptions}
        pending={pending}
        value={defaults.conversation_v1}
      />

      <StageRadioBlock
        error={errors.sleep_v1}
        idPrefix={p("sleep_v1-")}
        legend={STAGE_V1_TEXT.sleep(name)}
        name="sleep_v1"
        options={STAGE_V1_TEXT.sleepOptions}
        pending={pending}
        value={defaults.sleep_v1}
      />
    </div>
  );
}

function StageRadioBlock<T extends string>({
  legend,
  name,
  options,
  value: defaultValue,
  pending,
  error: err,
  idPrefix,
}: {
  legend: string;
  name: string;
  options: readonly { value: T; label: string }[];
  value: string | null;
  pending: boolean;
  error: string | undefined;
  idPrefix: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-foreground">{legend}</legend>
      {options.map(({ value, label }) => (
        <div className="flex items-center gap-2" key={value}>
          <input
            aria-describedby={err ? idPrefix + "err" : undefined}
            className="size-4 border-input text-accent"
            defaultChecked={defaultValue === value}
            disabled={pending}
            id={idPrefix + value}
            name={name}
            type="radio"
            value={value}
          />
          <label className="text-sm" htmlFor={idPrefix + value}>
            {label}
          </label>
        </div>
      ))}
      {err ? (
        <p className="text-sm text-destructive" id={idPrefix + "err"} role="alert">
          {err}
        </p>
      ) : null}
    </fieldset>
  );
}
