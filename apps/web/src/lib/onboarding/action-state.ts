export type OnboardingActionState =
  | { ok: true }
  | { ok: false; errors: Record<string, string>; errorCount: number };

const initialOk: OnboardingActionState = { ok: true };

export function onboardingActionInitialState(): OnboardingActionState {
  return initialOk;
}
