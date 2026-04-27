"use client";

import { useEffect, useRef } from "react";

export type ComposerProps = {
  onSubmit: (text: string) => void | Promise<void>;
  pending: boolean;
  /**
   * If set, prefills the textarea on mount and submits immediately. Used
   * by the home → conversation hand-off (clicking a starter chip).
   */
  autoSubmitText?: string | undefined;
  placeholder?: string;
  /** "sm" tightens the textarea height for the home prompt. */
  size?: "sm" | "md";
};

export function Composer({
  onSubmit,
  pending,
  autoSubmitText,
  placeholder = "Ask a question…",
  size = "md",
}: Readonly<ComposerProps>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const submittedAuto = useRef(false);

  useEffect(() => {
    if (!autoSubmitText || submittedAuto.current) return;
    submittedAuto.current = true;
    if (ref.current) {
      ref.current.value = autoSubmitText;
    }
    void onSubmit(autoSubmitText);
  }, [autoSubmitText, onSubmit]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const text = ref.current?.value.trim() ?? "";
    if (!text) return;
    void onSubmit(text);
    if (ref.current) {
      ref.current.value = "";
    }
  }

  return (
    <form
      className="rounded-lg border border-border bg-background p-3 shadow-md"
      data-testid="composer"
      onSubmit={handleSubmit}
    >
      <label className="sr-only" htmlFor="composer-textarea">
        Your question
      </label>
      <textarea
        className={
          "block w-full resize-none border-0 bg-transparent px-2 py-2 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none " +
          (size === "sm" ? "min-h-[3rem]" : "min-h-[5rem]")
        }
        data-testid="composer-textarea"
        disabled={pending}
        id="composer-textarea"
        name="question"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
          }
        }}
        placeholder={placeholder}
        ref={ref}
        rows={size === "sm" ? 2 : 3}
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {/* TODO(streaming): swap for token-by-token answer rendering when streaming ships. */}
          {pending ? "Thinking…" : "Press ↵ to send · Shift+↵ for newline"}
        </p>
        <button
          className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white outline-none ring-offset-background transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="composer-submit"
          disabled={pending}
          type="submit"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
