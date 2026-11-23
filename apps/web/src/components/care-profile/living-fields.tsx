"use client";

type Defaults = {
  livingSituation: string | null;
  careNetwork: string | null;
  careHoursPerWeek: number | null;
  caregiverProximity: string | null;
};

type Props = {
  defaults: Defaults;
  errors: Record<string, string>;
  pending: boolean;
  idPrefix?: string;
};

export function LivingFields({ defaults, errors, pending, idPrefix = "" }: Props) {
  const p = (s: string) => `${idPrefix}${s}`;

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor={p("field-living_situation")}>
          Where do they live?
        </label>
        <select
          aria-describedby={errors.living_situation ? p("error-living_situation") : undefined}
          aria-invalid={errors.living_situation ? true : undefined}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
          defaultValue={defaults.livingSituation ?? ""}
          disabled={pending}
          id={p("field-living_situation")}
          name="living_situation"
          required
        >
          <option disabled value="">
            Select…
          </option>
          <option value="with_caregiver">With you</option>
          <option value="alone">Alone</option>
          <option value="with_other_family">With another family member</option>
          <option value="assisted_living">Assisted living</option>
          <option value="memory_care">Memory care</option>
          <option value="nursing_home">Nursing home</option>
        </select>
        {errors.living_situation ? (
          <p
            className="mt-1 text-sm text-destructive"
            id={p("error-living_situation")}
            role="alert"
          >
            {errors.living_situation}
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor={p("field-care_network")}>
          Who else is involved in care?
        </label>
        <select
          aria-describedby={errors.care_network ? p("error-care_network") : undefined}
          aria-invalid={errors.care_network ? true : undefined}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
          defaultValue={defaults.careNetwork ?? ""}
          disabled={pending}
          id={p("field-care_network")}
          name="care_network"
          required
        >
          <option disabled value="">
            Select…
          </option>
          <option value="solo">Solo (mostly me)</option>
          <option value="siblings_helping">Siblings helping</option>
          <option value="paid_help">Paid help</option>
          <option value="spouse_of_cr">Spouse of the person I care for</option>
        </select>
        {errors.care_network ? (
          <p className="mt-1 text-sm text-destructive" id={p("error-care_network")} role="alert">
            {errors.care_network}
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor={p("field-care_hours_per_week")}>
          Hours per week you spend on care{" "}
          <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          aria-describedby={errors.care_hours_per_week ? p("error-care_hours_per_week") : undefined}
          aria-invalid={errors.care_hours_per_week ? true : undefined}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
          defaultValue={defaults.careHoursPerWeek ?? ""}
          disabled={pending}
          id={p("field-care_hours_per_week")}
          inputMode="numeric"
          name="care_hours_per_week"
          type="text"
        />
        {errors.care_hours_per_week ? (
          <p
            className="mt-1 text-sm text-destructive"
            id={p("error-care_hours_per_week")}
            role="alert"
          >
            {errors.care_hours_per_week}
          </p>
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Your proximity to them</legend>
        {(
          [
            ["same_home", "Same home"],
            ["same_city", "Same city"],
            ["remote", "Remote"],
          ] as const
        ).map(([value, label]) => (
          <div className="flex items-center gap-2" key={value}>
            <input
              aria-describedby={errors.caregiver_proximity ? p("error-caregiver_proximity") : undefined}
              className="size-4 border-input text-accent"
              defaultChecked={defaults.caregiverProximity === value}
              disabled={pending}
              id={p(`field-caregiver_proximity-${value}`)}
              name="caregiver_proximity"
              type="radio"
              value={value}
            />
            <label className="text-sm" htmlFor={p(`field-caregiver_proximity-${value}`)}>
              {label}
            </label>
          </div>
        ))}
        {errors.caregiver_proximity ? (
          <p
            className="text-sm text-destructive"
            id={p("error-caregiver_proximity")}
            role="alert"
          >
            {errors.caregiver_proximity}
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}
