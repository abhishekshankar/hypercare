"use client";

import { useActionState, useEffect } from "react";

import type { OnboardingActionState } from "@/lib/onboarding/action-state";
import { onboardingActionInitialState } from "@/lib/onboarding/action-state";

type Props = {
  action: (
    prev: OnboardingActionState,
    formData: FormData,
  ) => Promise<OnboardingActionState>;
  children: (ctx: {
    pending: boolean;
    errors: Record<string, string>;
  }) => React.ReactNode;
};

export function OnboardingStepForm({ action, children }: Props) {
  const [state, formAction, pending] = useActionState(action, onboardingActionInitialState());

  useEffect(() => {
    if (state.ok === false && state.errorCount > 0) {
      const firstKey = Object.keys(state.errors)[0];
      if (firstKey == null) {
        return;
      }
      const el = document.getElementById(`field-${firstKey.replace(/\./g, "-")}`);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [state]);

  return (
    <form action={formAction} noValidate>
      {state.ok === false && state.errorCount > 0 ? (
        <div
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-foreground"
          role="alert"
        >
          There {state.errorCount === 1 ? "is" : "are"} {state.errorCount}{" "}
          {state.errorCount === 1 ? "error" : "errors"} below. Please review the highlighted fields.
        </div>
      ) : null}
      {children({ pending, errors: state.ok === false ? state.errors : {} })}
    </form>
  );
}
