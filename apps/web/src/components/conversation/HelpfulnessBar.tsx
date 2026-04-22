"use client";

import { useCallback, useState } from "react";

type Props = Readonly<{
  messageId: string;
  initial: "up" | "down" | null;
  invited: boolean;
}>;

export function HelpfulnessBar({ messageId, initial, invited }: Props) {
  const [rating, setRating] = useState<"up" | "down" | null>(initial);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = useCallback(
    async (next: "up" | "down") => {
      setErr(null);
      setPending(true);
      try {
        const res = await fetch(`/api/app/messages/${messageId}/rating`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rating: next }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(t || res.statusText);
        }
        setRating(next);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not save");
      } finally {
        setPending(false);
      }
    },
    [messageId],
  );

  if (!invited) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2" data-testid="helpfulness-bar">
      <p className="text-xs text-muted-foreground">Was this helpful?</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-pressed={rating === "up"}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
          disabled={pending}
          onClick={() => void submit("up")}
          type="button"
        >
          Thumbs up
        </button>
        <button
          aria-pressed={rating === "down"}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
          disabled={pending}
          onClick={() => void submit("down")}
          type="button"
        >
          Thumbs down
        </button>
        {rating != null ? <span className="text-xs text-muted-foreground">Thanks for the signal.</span> : null}
      </div>
      {err != null ? <p className="text-xs text-destructive">{err}</p> : null}
    </div>
  );
}
