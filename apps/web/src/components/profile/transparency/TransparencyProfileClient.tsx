"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import {
  type MemoryTransparencySection,
  parseMemoryTransparencySections,
} from "@/lib/transparency/memory-display";

type ConvOption = {
  id: string;
  title: string | null;
  updatedAt: string;
  hasMemory: boolean;
};

type MemoryGet = {
  conversationId: string;
  conversations: ConvOption[];
  summary: string | null;
  sourceMessageCount: number;
  refreshedAt: string | null;
  hasRenderableSummary: boolean;
};

type CitationMod = {
  moduleSlug: string;
  title: string;
  citationCount: number;
  lastCitedAt: string;
};

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function TransparencyProfileClient() {
  const [memory, setMemory] = useState<MemoryGet | null>(null);
  const [citations, setCitations] = useState<CitationMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"refresh" | "clear" | null>(null);
  const [pendingForget, setPendingForget] = useState<{ text: string } | null>(null);
  const forgetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (conversationId?: string) => {
    setErr(null);
    const u = new URL("/api/app/transparency/memory", window.location.origin);
    if (conversationId) u.searchParams.set("conversationId", conversationId);
    const r = await fetch(u.toString());
    if (!r.ok) {
      setErr("Could not load conversation memory.");
      return;
    }
    const j = (await r.json()) as MemoryGet;
    setMemory(j);
  }, []);

  const loadCits = useCallback(async () => {
    const r = await fetch("/api/app/transparency/citations?days=30");
    if (!r.ok) return;
    const j = (await r.json()) as { modules: CitationMod[] };
    setCitations(j.modules);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await Promise.all([load(), loadCits()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load, loadCits]);

  useEffect(() => {
    return () => {
      if (forgetTimer.current) clearTimeout(forgetTimer.current);
    };
  }, []);

  const scheduleForget = (text: string) => {
    if (forgetTimer.current) clearTimeout(forgetTimer.current);
    setPendingForget({ text });
    forgetTimer.current = setTimeout(() => {
      forgetTimer.current = null;
      void commitForget(text);
    }, 5000);
  };

  const cancelPendingForget = () => {
    if (forgetTimer.current) clearTimeout(forgetTimer.current);
    forgetTimer.current = null;
    setPendingForget(null);
  };

  const commitForget = async (text: string) => {
    if (!memory?.conversationId) return;
    setPendingForget(null);
    const r = await fetch("/api/app/transparency/memory/forget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: memory.conversationId, text }),
    });
    if (!r.ok) {
      setErr("Could not update memory.");
      return;
    }
    await load(memory.conversationId);
  };

  const onRefresh = async () => {
    if (!memory?.conversationId) return;
    setBusy("refresh");
    setErr(null);
    try {
      const r = await fetch("/api/app/transparency/memory/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: memory.conversationId }),
      });
      if (!r.ok) {
        setErr("Refresh failed. Try again in a moment.");
        return;
      }
      await load(memory.conversationId);
    } finally {
      setBusy(null);
    }
  };

  const onClear = async () => {
    if (!memory?.conversationId) return;
    if (!window.confirm("Clear rolling memory for this conversation? It will rebuild after a few more chat turns.")) {
      return;
    }
    setBusy("clear");
    setErr(null);
    try {
      const r = await fetch("/api/app/transparency/memory/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: memory.conversationId }),
      });
      if (!r.ok) {
        setErr("Could not clear memory.");
        return;
      }
      await load(memory.conversationId);
    } finally {
      setBusy(null);
    }
  };

  const onPickConversation = async (id: string) => {
    await load(id);
  };

  if (loading && memory == null) {
    return <p className="text-sm text-muted-foreground">Loading transparency…</p>;
  }
  if (!loading && memory == null) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {err ?? "Could not load transparency."}
      </p>
    );
  }

  const convs = memory?.conversations ?? [];
  const noConversations = convs.length === 0;
  const summary = memory?.summary ?? null;
  const sections = summary != null ? parseMemoryTransparencySections(summary) : [];

  return (
    <div className="space-y-10">
      <section className="space-y-3" data-testid="transparency-memory-section">
        <h2 className="text-lg font-medium text-foreground">What Hypercare remembers from our conversations</h2>
        <p className="text-sm text-muted-foreground">
          Rolling summary for one chat at a time. Facts you store in your{" "}
          <Link className="underline underline-offset-2" href="/app/profile">
            care profile
          </Link>{" "}
          are edited there — that is the source of truth for long-lived details.
        </p>
        {err != null ? (
          <p className="text-sm text-destructive" role="alert">
            {err}
          </p>
        ) : null}
        {noConversations ? (
          <p className="text-sm text-foreground">
            Start a conversation from Home to see memory here after a few turns.
          </p>
        ) : (
          <>
            {convs.length > 1 ? (
              <label className="flex max-w-md flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Conversation</span>
                <select
                  className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
                  onChange={(e) => {
                    void onPickConversation(e.target.value);
                  }}
                  value={memory?.conversationId ?? ""}
                >
                  {convs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.title?.trim() || "Conversation") + (c.hasMemory ? "" : " · no memory yet")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {!memory?.hasRenderableSummary ? (
              <p className="text-sm text-foreground">
                We don&apos;t have any conversation memory yet. Once you&apos;ve been chatting for a few turns, a
                summary of what we&apos;re discussing will appear here.
              </p>
            ) : (
              <div className="space-y-6">
                {sections.map((sec: MemoryTransparencySection) => (
                  <div key={sec.heading}>
                    <h3 className="text-base font-medium text-foreground">{sec.heading}</h3>
                    <ul className="mt-2 list-none space-y-2 pl-0">
                      {sec.bullets.map((b: string) => (
                        <li key={`${sec.heading}-${b}`}>
                          <div
                            className="flex gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                scheduleForget(b);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <p className="flex-1 text-sm text-foreground">{b}</p>
                            <button
                              aria-label={`Forget this memory: ${b.slice(0, 120)}`}
                              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={() => {
                                scheduleForget(b);
                              }}
                              type="button"
                            >
                              <span aria-hidden>×</span>
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {sections.length === 0 && summary != null && summary.trim().length > 0 ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{summary}</ReactMarkdown>
                  </div>
                ) : null}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              This memory is used to make your next answer feel like it&apos;s continuing the conversation. It never
              leaves your account.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                disabled={busy !== null || noConversations}
                onClick={() => {
                  void onRefresh();
                }}
                type="button"
              >
                {busy === "refresh" ? "Refreshing…" : "Refresh memory now"}
              </button>
              <button
                className="rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
                disabled={busy !== null || noConversations}
                onClick={() => {
                  void onClear();
                }}
                type="button"
              >
                {busy === "clear" ? "Clearing…" : "Clear memory for this conversation"}
              </button>
            </div>
            {memory?.refreshedAt != null ? (
              <p className="text-xs text-muted-foreground">Last updated {formatShortDate(memory.refreshedAt)}.</p>
            ) : null}
          </>
        )}
      </section>

      {pendingForget != null ? (
        <div
          className="fixed bottom-4 left-1/2 z-50 flex w-[min(100%-2rem,28rem)] -translate-x-1/2 items-center justify-between gap-4 rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground shadow-lg"
          data-testid="transparency-forget-toast"
          role="status"
        >
          <span>We won&apos;t mention that again in this conversation.</span>
          <button
            className="text-accent underline-offset-2 hover:underline"
            onClick={cancelPendingForget}
            type="button"
          >
            Undo
          </button>
        </div>
      ) : null}

      <section className="space-y-3" data-testid="transparency-citations-section">
        <h2 className="text-lg font-medium text-foreground">What we&apos;ve cited to you recently</h2>
        <p className="text-sm text-muted-foreground">
          Modules Hypercare has pointed to in assistant answers over the last 30 days (by citation footers).
        </p>
        {citations.length === 0 ? (
          <p className="text-sm text-foreground">No module citations in the last 30 days yet.</p>
        ) : (
          <ul className="space-y-2">
            {citations.map((m) => (
              <li
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                key={m.moduleSlug}
              >
                <span className="font-medium text-foreground">{m.title}</span>
                <span className="text-muted-foreground">
                  Cited {m.citationCount}× · last {formatShortDate(m.lastCitedAt)}
                </span>
                <Link
                  className="text-accent underline-offset-2 hover:underline"
                  href={`/app/modules/${m.moduleSlug}`}
                >
                  See module
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
