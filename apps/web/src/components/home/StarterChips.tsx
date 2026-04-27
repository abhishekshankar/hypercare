"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Composer } from "@/components/conversation/Composer";

function useStartConversation() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startConversation(text: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/app/conversation/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/app/conversation/${id}?q=${encodeURIComponent(text)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setError(msg);
      setPending(false);
    }
  }

  return { startConversation, pending, error, setError };
}

export function HomeAsk({
  starters,
}: Readonly<{
  starters: readonly string[];
}>) {
  const { startConversation, pending, error } = useStartConversation();
  return (
    <div className="space-y-4" data-testid="home-ask-block">
      <section aria-label="Ask Alongside a question" className="space-y-3">
        <Composer
          onSubmit={startConversation}
          pending={pending}
          placeholder="Ask anything about today, this week, or what comes next…"
          size="md"
        />
        {error ? (
          <p className="text-sm text-red-700" data-testid="home-error" role="alert">
            Couldn’t start that conversation — {error}.
          </p>
        ) : null}
      </section>
      <div>
        <p className="along-section-label mb-3">Or start with…</p>
        <ul className="flex flex-wrap gap-2" data-testid="starter-chips">
          {starters.map((text) => (
            <li key={text}>
              <button
                className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground outline-none ring-offset-background transition hover:border-accent/60 hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-accent"
                data-testid="starter-chip"
                disabled={pending}
                onClick={() => void startConversation(text)}
                type="button"
              >
                {text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
