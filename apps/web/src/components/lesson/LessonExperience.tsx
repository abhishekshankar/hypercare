"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LessonCarousel } from "./LessonCarousel";
import { LessonCloseCard } from "./LessonCloseCard";
import { parseLessonSource, type LessonSource } from "@/lib/lesson/source";
import { createSseParser, parseSseDataJson } from "@/lib/sse";
import {
  buildLessonSlidesData,
  type SlideData,
  type LessonSseCardKind,
  streamCardToSlideData,
} from "@/lib/lesson/slice-stream";

import type { ModulePagePayload } from "@/lib/library/load-module";

function LessonCardSkeleton({ reduceMotion }: Readonly<{ reduceMotion: boolean }>) {
  return (
    <div
      className={
        reduceMotion
          ? "h-40 rounded-lg bg-muted/50"
          : "h-40 animate-pulse rounded-lg bg-muted/50"
      }
      data-testid="lesson-card-skeleton"
    />
  );
}

type StreamCardPayload = { index: number; kind: string; body_md: string };

function isSseKind(s: string): s is LessonSseCardKind {
  return s === "intro" || s === "content" || s === "technique" || s === "recap" || s === "check_in";
}

function usePrefersReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (m == null) {
      return;
    }
    setR(m.matches);
    const h = () => setR(m.matches);
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);
  return r;
}

export function LessonExperience(
  props: Readonly<{
    mod: ModulePagePayload | null;
    slug: string;
    crFirstName: string | null;
    userStage: "early" | "middle" | "late" | null;
    sourceParam: string | null;
    /** Server + public flags (both) — see ADR 0029. */
    lessonStreamEnabled: boolean;
    /** SRS resurface one-liner (TASK-037) when this lesson matches weekly focus. */
    reviewHint?: string | null;
  }>,
) {
  const { mod, slug, crFirstName, userStage, sourceParam, lessonStreamEnabled: useStream, reviewHint } =
    props;
  const router = useRouter();
  const reduceMotion = usePrefersReducedMotion();
  const streamAbortRef = useRef<AbortController | null>(null);

  if (!useStream && mod == null) {
    throw new Error("LessonExperience: `mod` is required when streaming is off");
  }

  const staticSlides = useMemo(
    () => (useStream || mod == null ? [] : buildLessonSlidesData(mod, crFirstName, userStage)),
    [useStream, mod, crFirstName, userStage],
  );

  const [streamSlides, setStreamSlides] = useState<(SlideData | null)[] | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamDone, setStreamDone] = useState(!useStream);
  const [streamRetry, setStreamRetry] = useState(0);

  const [index, setIndex] = useState(0);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const source: LessonSource = parseLessonSource(sourceParam);

  useEffect(() => {
    if (!useStream) {
      return;
    }
    const ac = new AbortController();
    streamAbortRef.current = ac;
    setStreamError(null);
    setStreamDone(false);
    setStreamSlides(null);
    setIndex(0);
    void (async () => {
      try {
        const res = await fetch(`/api/app/lesson/${encodeURIComponent(slug)}`, {
          method: "GET",
          signal: ac.signal,
          headers: { Accept: "text/event-stream" },
        });
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Not found" : `load ${res.status}`);
        }
        if (!res.body) {
          throw new Error("empty body");
        }
        const reader = res.body.getReader();
        const parser = createSseParser((ev) => {
          if (ev.event === "started") {
            const j = parseSseDataJson<{ cardCount?: number }>(ev.data);
            if (j?.cardCount != null) {
              setStreamSlides(Array.from({ length: j.cardCount }, () => null));
            }
            return;
          }
          if (ev.event === "card") {
            const c = parseSseDataJson<StreamCardPayload>(ev.data);
            if (c == null || typeof c.index !== "number" || !isSseKind(c.kind)) {
              return;
            }
            const slide = streamCardToSlideData({
              index: c.index,
              kind: c.kind,
              body_md: c.body_md ?? "",
            });
            setStreamSlides((prev) => {
              if (prev == null) {
                return prev;
              }
              const next = [...prev];
              if (c.index < next.length) {
                next[c.index] = slide;
              }
              return next;
            });
            return;
          }
          if (ev.event === "done") {
            setStreamDone(true);
            return;
          }
          if (ev.event === "error") {
            const j = parseSseDataJson<{ message?: string }>(ev.data);
            setStreamError(j?.message ?? "This lesson didn’t load — try again");
          }
        });
        for (;;) {
          const { done, value } = await reader.read();
          if (value) {
            parser.push(value);
          }
          if (done) {
            parser.end();
            break;
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          return;
        }
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
        if (!ac.signal.aborted) {
          setStreamError(e instanceof Error ? e.message : "This lesson didn’t load — try again");
        }
      }
    })();
    return () => {
      ac.abort();
      streamAbortRef.current = null;
    };
  }, [useStream, slug, streamRetry]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/app/lesson/${encodeURIComponent(slug)}/start`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source }),
        });
        if (!res.ok) {
          throw new Error(`start ${res.status}`);
        }
        const j = (await res.json()) as { progressId: string };
        if (!cancelled) {
          setProgressId(j.progressId);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Couldn’t start lesson");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, source]);

  const onClose = useCallback(
    async (revisit: boolean) => {
      if (progressId == null) {
        return;
      }
      const res = await fetch(`/api/app/lesson/${encodeURIComponent(slug)}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ progressId, revisit }),
      });
      if (!res.ok) {
        setErr("Couldn’t save progress");
        return;
      }
      router.push("/app?saved=1");
    },
    [progressId, router, slug],
  );

  const total = useStream ? (streamSlides?.length ?? 6) : staticSlides.length;

  const currentSlide: SlideData | "skeleton" = useStream
    ? (streamSlides == null
        ? "skeleton"
        : (streamSlides[index] ?? "skeleton"))
    : (staticSlides[index] ?? { kind: "close" as const });

  const showSkeleton = useStream && currentSlide === "skeleton";
  const onCloseCard =
    !showSkeleton && typeof currentSlide === "object" && currentSlide.kind === "close";
  const canComplete = onCloseCard && progressId != null && (!useStream || streamDone);

  const nextLocked =
    useStream &&
    index < total - 1 &&
    streamSlides != null &&
    streamSlides[index + 1] == null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useStream && e.key === "Escape" && streamError == null) {
        e.preventDefault();
        streamAbortRef.current?.abort();
        router.push("/app?lesson_cancel=1");
        return;
      }
      if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "ArrowRight" && !nextLocked) {
        setIndex((i) => Math.min(total - 1, i + 1));
        return;
      }
      if (e.key === "Enter" && index === total - 1 && progressId != null && canComplete) {
        e.preventDefault();
        void onClose(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    useStream,
    streamError,
    router,
    nextLocked,
    total,
    index,
    progressId,
    canComplete,
    onClose,
  ]);

  if (useStream && streamError != null) {
    return (
      <div className="mx-auto max-w-md px-1 pb-12" data-testid="lesson-page">
        <p className="text-sm text-destructive" role="alert" data-testid="lesson-stream-error">
          {streamError}
        </p>
        <button
          type="button"
          className="mt-2 text-sm text-accent underline"
          onClick={() => {
            setStreamRetry((k) => k + 1);
            setStreamError(null);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (useStream && streamSlides == null) {
    return (
      <div className="mx-auto max-w-md px-1 pb-12" data-testid="lesson-page">
        <p className="text-xs text-muted-foreground">Loading lesson…</p>
        <div className="mt-4">
          <LessonCardSkeleton reduceMotion={reduceMotion} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-1 pb-12" data-testid="lesson-page" aria-live="polite">
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">About 5 min · Daily lesson</p>
        <Link
          className="text-sm text-accent underline-offset-2 hover:underline"
          href={`/app/modules/${encodeURIComponent(slug)}`}
        >
          Back to full module
        </Link>
      </header>
      {err != null && err.length > 0 ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {err}
        </p>
      ) : null}
      {reviewHint != null && reviewHint.length > 0 ? (
        <p className="mb-2 text-sm text-muted-foreground" data-testid="lesson-review-hint">
          {reviewHint}
        </p>
      ) : null}
      <LessonCarousel
        current={index}
        onNext={() => {
          setIndex((i) => Math.min(total - 1, i + 1));
        }}
        onPrev={() => {
          setIndex((i) => Math.max(0, i - 1));
        }}
        total={total}
        lockNext={nextLocked}
      >
        {showSkeleton ? <LessonCardSkeleton reduceMotion={reduceMotion} /> : null}
        {!showSkeleton && typeof currentSlide === "object" && currentSlide.kind === "setup" ? (
          <div data-testid="lesson-card-setup" className="space-y-3">
            <h1 className="font-serif text-2xl font-normal leading-tight text-foreground">
              {currentSlide.title}
            </h1>
            <p className="text-base text-foreground">{currentSlide.line}</p>
            {currentSlide.stageNote != null && currentSlide.stageNote.length > 0 ? (
              <p className="text-sm text-muted-foreground">{currentSlide.stageNote}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">Setup (about 1 min)</p>
          </div>
        ) : null}
        {!showSkeleton && typeof currentSlide === "object" && currentSlide.kind === "core" ? (
          <article data-testid="lesson-core-card" className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-foreground">{currentSlide.title}</h2>
            <div className="prose prose-neutral max-w-none text-base leading-relaxed text-foreground">
              {currentSlide.body.split("\n\n").map((p, b) => (
                <p className="mb-2 last:mb-0" key={b}>
                  {p}
                </p>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Core (about 2–3 min total)</p>
          </article>
        ) : null}
        {!showSkeleton && typeof currentSlide === "object" && currentSlide.kind === "try" ? (
          <div className="space-y-2" data-testid="lesson-try-card">
            <h2 className="font-serif text-xl font-medium text-foreground">Try this today</h2>
            <p className="text-base text-foreground">{currentSlide.text}</p>
            <p className="text-xs text-muted-foreground">Practical step (about 30 sec)</p>
          </div>
        ) : null}
        {!showSkeleton && typeof currentSlide === "object" && currentSlide.kind === "close" ? (
          <LessonCloseCard
            onComplete={(revisit) => void onClose(revisit)}
            pending={progressId == null || (useStream && !streamDone)}
          />
        ) : null}
      </LessonCarousel>
    </div>
  );
}
