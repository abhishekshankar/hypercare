"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SavedItem } from "@/lib/saved/types";

type PendingRemove = { saveId: string; snapshot: SavedItem; timer: ReturnType<typeof setTimeout> };

const UNDO_MS = 5000;

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}

export function SavesPageClient() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SavedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRemove | null>(null);
  const pendingRef = useRef<PendingRemove | null>(null);

  const runFetch = useCallback(
    async (opts: { cursor: string | null; replace: boolean; query: string }) => {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (opts.query.trim()) {
        params.set("q", opts.query.trim());
      }
      if (opts.cursor) {
        params.set("cursor", opts.cursor);
      }
      const res = await fetch(`/api/app/saved-answers?${params.toString()}`);
      if (res.status === 401) {
        setError("signed_out");
        return;
      }
      if (!res.ok) {
        setError("load_failed");
        return;
      }
      const data = (await res.json()) as { items: SavedItem[]; nextCursor: string | null };
      setItems((prev) => (opts.replace ? data.items : [...prev, ...data.items]));
      setNextCursor(data.nextCursor);
      setError(null);
    },
    [],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void runFetch({ cursor: null, replace: true, query: q }).finally(() => {
        setLoading(false);
      });
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [q, runFetch]);

  const onLoadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    void runFetch({ cursor: nextCursor, replace: false, query: q }).finally(() => {
      setLoadingMore(false);
    });
  }, [nextCursor, loadingMore, q, runFetch]);

  const onRemove = useCallback(
    (it: SavedItem) => {
      if (pendingRef.current) {
        clearTimeout(pendingRef.current.timer);
        pendingRef.current = null;
        setPending(null);
      }
      setItems((prev) => prev.filter((x) => x.id !== it.id));
      const timer = setTimeout(() => {
        void fetch(`/api/app/saved-answers/${it.id}`, { method: "DELETE" }).then((res) => {
          if (!res.ok) {
            setItems((prev) => {
              if (prev.some((p) => p.id === it.id)) return prev;
              return [it, ...prev].sort(
                (a, b) => +new Date(b.saved_at) - +new Date(a.saved_at),
              );
            });
          }
        });
        pendingRef.current = null;
        setPending(null);
      }, UNDO_MS);
      const pr: PendingRemove = { saveId: it.id, snapshot: it, timer };
      pendingRef.current = pr;
      setPending(pr);
    },
    [],
  );

  const onUndo = useCallback(() => {
    if (!pending) return;
    clearTimeout(pending.timer);
    setItems((prev) => {
      if (prev.some((x) => x.id === pending.snapshot.id)) return prev;
      return [pending.snapshot, ...prev].sort(
        (a, b) => +new Date(b.saved_at) - +new Date(a.saved_at),
      );
    });
    pendingRef.current = null;
    setPending(null);
  }, [pending]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-foreground">Saved answers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Answers you bookmarked in chat.</p>
      </div>
      <div>
        <label className="sr-only" htmlFor="saves-search">
          Search saved answers
        </label>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          data-testid="saves-search"
          id="saves-search"
          onChange={(e) => {
            setQ(e.target.value);
          }}
          placeholder="Search…"
          value={q}
        />
      </div>
      {error === "load_failed" ? <p className="text-sm text-destructive">Couldn’t load saves.</p> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q.trim() ? "No saves match that search." : "Nothing saved yet. Save an answer from a conversation to see it here."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-background">
          {items.map((it) => (
            <li className="px-4 py-4" key={it.id}>
              <div className="flex flex-col gap-1">
                <Link
                  className="text-sm font-medium text-foreground hover:underline"
                  href={`/app/conversation/${it.conversation_id}#message-${it.message_id}`}
                >
                  {truncate(it.question_text, 200)}
                </Link>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {it.assistant_text_preview}
                </p>
                {it.note && it.note.trim() ? (
                  <p className="text-sm text-foreground/90">
                    <span className="font-medium text-foreground/80">Note: </span>
                    {it.note}
                  </p>
                ) : null}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {it.module_slugs.length > 0
                      ? `From: ${it.module_slugs.join(", ")}`
                      : "Saved answer"}
                  </span>
                  <button
                    className="text-xs text-destructive underline-offset-2 hover:underline"
                    onClick={() => {
                      onRemove(it);
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {nextCursor && !loading ? (
        <div className="flex justify-center">
          <button
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted/50 disabled:opacity-50"
            disabled={loadingMore}
            onClick={() => {
              onLoadMore();
            }}
            type="button"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
      {pending ? (
        <div
          className="fixed bottom-4 left-1/2 z-50 flex w-[min(100%-2rem,28rem)] -translate-x-1/2 items-center justify-between gap-4 rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground shadow-lg"
          data-testid="saves-undo-toast"
          role="status"
        >
          <span>Removed.</span>
          <button
            className="text-accent underline-offset-2 hover:underline"
            onClick={onUndo}
            type="button"
          >
            Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}
