"use client";

import { useCallback, useId, useState } from "react";

export type InitialSave = { saveId: string; note: string | null } | null;

const NOTE_MAX = 240;

type Props = {
  messageId: string;
  initial: InitialSave;
  onMutate?: (() => void) | undefined;
};

export function SaveAnswerBar({ messageId, initial, onMutate }: Readonly<Props>) {
  const fieldId = useId();
  const [saveId, setSaveId] = useState<string | null>(initial?.saveId ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [showNote, setShowNote] = useState(Boolean(initial?.saveId));
  const [pending, setPending] = useState<"save" | "unsave" | "note" | null>(null);
  const saved = saveId != null;

  const patchNote = useCallback(
    async (sid: string, text: string) => {
      setPending("note");
      try {
        const res = await fetch(`/api/app/saved-answers/${sid}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ note: text.trim() === "" ? null : text.slice(0, NOTE_MAX) }),
        });
        if (!res.ok) {
          return;
        }
        onMutate?.();
      } finally {
        setPending(null);
      }
    },
    [onMutate],
  );

  const onToggle = useCallback(async () => {
    if (saveId) {
      setPending("unsave");
      try {
        const res = await fetch(`/api/app/saved-answers/${saveId}`, { method: "DELETE" });
        if (res.status === 404 || res.status === 401) {
          return;
        }
        if (res.ok) {
          setSaveId(null);
          setShowNote(false);
          setNote("");
          onMutate?.();
        }
      } finally {
        setPending(null);
      }
      return;
    }
    setPending("save");
    try {
      const res = await fetch("/api/app/saved-answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message_id: messageId, note: null }),
      });
      if (res.status === 401) return;
      if (res.status === 201 || res.status === 409) {
        const data = (await res.json()) as { id: string };
        setSaveId(data.id);
        setShowNote(true);
        onMutate?.();
      }
    } finally {
      setPending(null);
    }
  }, [messageId, saveId, onMutate]);

  return (
    <div className="mt-3 border-t border-border/60 pt-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="save-this-button"
          disabled={Boolean(pending)}
          onClick={() => {
            void onToggle();
          }}
          type="button"
        >
          <span aria-hidden className="text-base">
            {saved ? "✓" : "☆"}
          </span>
          {pending === "save" || pending === "unsave"
            ? "…"
            : saved
              ? "Saved"
              : "Save this"}
        </button>
      </div>
      {showNote && saveId ? (
        <div className="mt-2">
          <label className="sr-only" htmlFor={fieldId}>
            Why are you saving this? (optional)
          </label>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            data-testid="save-note-input"
            id={fieldId}
            maxLength={NOTE_MAX}
            onBlur={() => {
              void patchNote(saveId, note);
            }}
            onChange={(e) => {
              setNote(e.target.value);
            }}
            placeholder="Why are you saving this? (optional)"
            value={note}
          />
        </div>
      ) : null}
    </div>
  );
}
