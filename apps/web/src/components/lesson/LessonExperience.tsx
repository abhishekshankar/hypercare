"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LessonCarousel } from "./LessonCarousel";
import { LessonCloseCard } from "./LessonCloseCard";
import { pickCoreSections, splitBodyIntoSections } from "@/lib/lesson/load";
import { parseLessonSource, type LessonSource } from "@/lib/lesson/source";

import type { ModulePagePayload } from "@/lib/library/load-module";

type SlideData =
  | { kind: "setup"; title: string; line: string; stageNote?: string }
  | { kind: "core"; title: string; body: string }
  | { kind: "try"; text: string }
  | { kind: "close" };

function buildSlides(
  mod: ModulePagePayload,
  crFirstName: string | null,
  userStage: "early" | "middle" | "late" | null,
): SlideData[] {
  const sections = splitBodyIntoSections(mod.bodyMd);
  const core = pickCoreSections(sections, mod.summary);
  const name = crFirstName?.trim() ?? null;
  const line =
    name != null && name.length > 0
      ? `Why this matters for ${name} — a short, practical path you can use this week.`
      : "Why this matters — a short, practical path you can use this week.";

  let stageNote: string | undefined;
  if (userStage && mod.stageRelevance.includes(userStage)) {
    const label =
      userStage === "early" ? "Early" : userStage === "middle" ? "Middle" : "Late";
    stageNote = `This topic often comes up in the ${label} stage — you’re in good company.`;
  }

  const tryText =
    mod.tryThisToday?.trim() ?? "Try one thing from this lesson today, even a small one.";

  const setup: SlideData = stageNote
    ? { kind: "setup", title: mod.title, line, stageNote }
    : { kind: "setup", title: mod.title, line };
  return [
    setup,
    { kind: "core", title: core[0]!.title, body: core[0]!.body },
    { kind: "core", title: core[1]!.title, body: core[1]!.body },
    { kind: "core", title: core[2]!.title, body: core[2]!.body },
    { kind: "try", text: tryText },
    { kind: "close" },
  ];
}

export function LessonExperience(props: Readonly<{
  mod: ModulePagePayload;
  crFirstName: string | null;
  userStage: "early" | "middle" | "late" | null;
  sourceParam: string | null;
}>) {
  const { mod, crFirstName, userStage, sourceParam } = props;
  const router = useRouter();
  const slides = useMemo(
    () => buildSlides(mod, crFirstName, userStage),
    [mod, crFirstName, userStage],
  );
  const [index, setIndex] = useState(0);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const source: LessonSource = parseLessonSource(sourceParam);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/app/lesson/${encodeURIComponent(mod.slug)}/start`, {
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
  }, [mod.slug, source]);

  const onClose = useCallback(
    async (revisit: boolean) => {
      if (progressId == null) {
        return;
      }
      const res = await fetch(`/api/app/lesson/${encodeURIComponent(mod.slug)}/complete`, {
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
    [mod.slug, progressId, router],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(slides.length - 1, i + 1));
      }
      if (e.key === "Enter" && index === slides.length - 1 && progressId != null) {
        e.preventDefault();
        void onClose(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, index, progressId, onClose]);

  const s = slides[index]!;

  return (
    <div className="mx-auto max-w-md px-1 pb-12">
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">About 5 min · Daily lesson</p>
        <Link
          className="text-sm text-accent underline-offset-2 hover:underline"
          href={`/app/modules/${encodeURIComponent(mod.slug)}`}
        >
          Back to full module
        </Link>
      </header>
      {err ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {err}
        </p>
      ) : null}
      <LessonCarousel
        current={index}
        onNext={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        total={slides.length}
      >
        {s.kind === "setup" ? (
          <div data-testid="lesson-card-setup" className="space-y-3">
            <h1 className="font-serif text-2xl font-normal leading-tight text-foreground">
              {s.title}
            </h1>
            <p className="text-base text-foreground">{s.line}</p>
            {s.stageNote != null && s.stageNote.length > 0 ? (
              <p className="text-sm text-muted-foreground">{s.stageNote}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">Setup (about 1 min)</p>
          </div>
        ) : null}
        {s.kind === "core" ? (
          <article data-testid="lesson-core-card" className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-foreground">{s.title}</h2>
            <div className="prose prose-neutral max-w-none text-base leading-relaxed text-foreground">
              {s.body.split("\n\n").map((p, i) => (
                <p className="mb-2 last:mb-0" key={i}>
                  {p}
                </p>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Core (about 2–3 min total)</p>
          </article>
        ) : null}
        {s.kind === "try" ? (
          <div className="space-y-2" data-testid="lesson-try-card">
            <h2 className="font-serif text-xl font-medium text-foreground">Try this today</h2>
            <p className="text-base text-foreground">{s.text}</p>
            <p className="text-xs text-muted-foreground">Practical step (about 30 sec)</p>
          </div>
        ) : null}
        {s.kind === "close" ? (
          <LessonCloseCard
            onComplete={(revisit) => void onClose(revisit)}
            pending={progressId == null}
          />
        ) : null}
      </LessonCarousel>
    </div>
  );
}
