"use client";

type Defaults = {
  crFirstName: string;
  crAge: number | null;
  crRelationship: string;
  crDiagnosis: string | null;
  crDiagnosisYear: number | null;
};

type Props = {
  defaults: Defaults;
  errors: Record<string, string>;
  pending: boolean;
  /** e.g. `onb-` to avoid clashing in rare multi-form pages */
  idPrefix?: string;
};

export function AboutCrFields({ defaults, errors, pending, idPrefix = "" }: Props) {
  const p = (name: string) => `${idPrefix}${name}`;
  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor={p("field-cr_first_name")}>
          Their first name
        </label>
        <input
          aria-describedby={errors.cr_first_name ? p("error-cr_first_name") : undefined}
          aria-invalid={errors.cr_first_name ? true : undefined}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
          defaultValue={defaults.crFirstName}
          disabled={pending}
          id={p("field-cr_first_name")}
          name="cr_first_name"
          required
          type="text"
        />
        {errors.cr_first_name ? (
          <p
            className="mt-1 text-sm text-destructive"
            id={p("error-cr_first_name")}
            role="alert"
          >
            {errors.cr_first_name}
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor={p("field-cr_age")}>
          Their age <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          aria-describedby={errors.cr_age ? p("error-cr_age") : undefined}
          aria-invalid={errors.cr_age ? true : undefined}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
          defaultValue={defaults.crAge ?? ""}
          disabled={pending}
          id={p("field-cr_age")}
          inputMode="numeric"
          name="cr_age"
          type="text"
        />
        {errors.cr_age ? (
          <p className="mt-1 text-sm text-destructive" id={p("error-cr_age")} role="alert">
            {errors.cr_age}
          </p>
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Your relationship</legend>
        {(
          [
            ["parent", "Parent"],
            ["spouse", "Spouse"],
            ["sibling", "Sibling"],
            ["in_law", "In-law"],
            ["other", "Other"],
          ] as const
        ).map(([value, label]) => (
          <div className="flex items-center gap-2" key={value}>
            <input
              aria-describedby={errors.cr_relationship ? p("error-cr_relationship") : undefined}
              className="size-4 border-input text-accent"
              defaultChecked={defaults.crRelationship === value}
              disabled={pending}
              id={p(`field-cr_relationship-${value}`)}
              name="cr_relationship"
              type="radio"
              value={value}
            />
            <label className="text-sm" htmlFor={p(`field-cr_relationship-${value}`)}>
              {label}
            </label>
          </div>
        ))}
        {errors.cr_relationship ? (
          <p
            className="text-sm text-destructive"
            id={p("error-cr_relationship")}
            role="alert"
          >
            {errors.cr_relationship}
          </p>
        ) : null}
      </fieldset>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor={p("field-cr_diagnosis")}>
          Diagnosis, if known{" "}
          <span className="text-muted-foreground">(optional — you can skip)</span>
        </label>
        <select
          aria-describedby={errors.cr_diagnosis ? p("error-cr_diagnosis") : undefined}
          aria-invalid={errors.cr_diagnosis ? true : undefined}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
          defaultValue={
            defaults.crDiagnosis == null || defaults.crDiagnosis === ""
              ? "__prefer_not__"
              : defaults.crDiagnosis
          }
          disabled={pending}
          id={p("field-cr_diagnosis")}
          name="cr_diagnosis"
        >
          <option value="__prefer_not__">Prefer not to say</option>
          <option value="alzheimers">Alzheimer&apos;s</option>
          <option value="vascular">Vascular</option>
          <option value="lewy_body">Lewy body</option>
          <option value="frontotemporal">Frontotemporal</option>
          <option value="mixed">Mixed</option>
          <option value="unknown_type">Dementia — type unknown</option>
          <option value="suspected_undiagnosed">Not formally diagnosed but I suspect</option>
        </select>
        {errors.cr_diagnosis ? (
          <p
            className="mt-1 text-sm text-destructive"
            id={p("error-cr_diagnosis")}
            role="alert"
          >
            {errors.cr_diagnosis}
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor={p("field-cr_diagnosis_year")}>
          Year of diagnosis or when symptoms began{" "}
          <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          aria-describedby={errors.cr_diagnosis_year ? p("error-cr_diagnosis_year") : undefined}
          aria-invalid={errors.cr_diagnosis_year ? true : undefined}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
          defaultValue={defaults.crDiagnosisYear ?? ""}
          disabled={pending}
          id={p("field-cr_diagnosis_year")}
          inputMode="numeric"
          name="cr_diagnosis_year"
          type="text"
        />
        {errors.cr_diagnosis_year ? (
          <p
            className="mt-1 text-sm text-destructive"
            id={p("error-cr_diagnosis_year")}
            role="alert"
          >
            {errors.cr_diagnosis_year}
          </p>
        ) : null}
      </div>
    </div>
  );
}
