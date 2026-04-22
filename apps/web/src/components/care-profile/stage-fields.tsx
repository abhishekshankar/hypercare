"use client";

import type { StageAnswersRecord } from "@/lib/onboarding/stage-keys";
import { STAGE_ANSWER_KEYS } from "@/lib/onboarding/stage-keys";

const QUESTIONS: { key: (typeof STAGE_ANSWER_KEYS)[number]; text: (name: string) => string }[] = [
  {
    key: "manages_meds",
    text: (name) => `Can ${name} manage their own medications?`,
  },
  {
    key: "drives",
    text: (name) => `Does ${name} still drive? If not, when did they stop?`,
  },
  {
    key: "left_alone",
    text: (name) => `Can ${name} be left alone safely for a few hours?`,
  },
  {
    key: "recognizes_you",
    text: (name) => `Does ${name} recognize you most of the time?`,
  },
  {
    key: "bathes_alone",
    text: (name) => `Can ${name} bathe and dress without help?`,
  },
  {
    key: "wandering_incidents",
    text: (name) => `Has ${name} had incidents of getting lost or wandering?`,
  },
  {
    key: "conversations",
    text: (name) => `Does ${name} still carry on conversations that make sense to you?`,
  },
  {
    key: "sleeps_through_night",
    text: (name) => `Does ${name} sleep through the night usually?`,
  },
];

type Props = {
  crFirstName: string;
  defaults: StageAnswersRecord;
  errors: Record<string, string>;
  pending: boolean;
  idPrefix?: string;
};

export function StageFields({ crFirstName, defaults, errors, pending, idPrefix = "" }: Props) {
  const name = crFirstName.trim().length > 0 ? crFirstName.trim() : "they";
  const p = (s: string) => `${idPrefix}${s}`;

  return (
    <div className="space-y-8">
      {QUESTIONS.map(({ key, text }) => (
        <fieldset className="space-y-2" key={key}>
          <legend className="mb-1 text-sm font-medium text-foreground">{text(name)}</legend>
          {(
            [
              ["yes", "Yes"],
              ["no", "No"],
              ["unsure", "Unsure"],
            ] as const
          ).map(([value, label]) => (
            <div className="flex items-center gap-2" key={value}>
              <input
                aria-describedby={errors[key] ? p(`error-${key}`) : undefined}
                className="size-4 border-input text-accent"
                defaultChecked={defaults[key] === value}
                disabled={pending}
                id={p(`field-${key}-${value}`)}
                name={key}
                type="radio"
                value={value}
              />
              <label className="text-sm" htmlFor={p(`field-${key}-${value}`)}>
                {label}
              </label>
            </div>
          ))}
          {errors[key] ? (
            <p className="text-sm text-destructive" id={p(`error-${key}`)} role="alert">
              {errors[key]}
            </p>
          ) : null}
        </fieldset>
      ))}
    </div>
  );
}
