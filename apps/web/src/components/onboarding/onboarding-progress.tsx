type Props = {
  step: number;
};

export function OnboardingProgress({ step }: Props) {
  const max = 5;
  const safe = Math.min(Math.max(step, 1), max);
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-sm text-muted-foreground">
        <span id="onboarding-progress-label">
          Step {safe} of {max}
        </span>
      </div>
      <div
        aria-labelledby="onboarding-progress-label"
        aria-valuemax={max}
        aria-valuemin={1}
        aria-valuenow={safe}
        className="h-2 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${(safe / max) * 100}%` }}
        />
      </div>
    </div>
  );
}
