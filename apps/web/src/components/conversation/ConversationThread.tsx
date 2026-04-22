"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { Citation, RefusalReason, SafetyTriageReason } from "@hypercare/rag";

import { CitationChip } from "./CitationChip";
import { CitationExpansion } from "./CitationExpansion";
import { Composer } from "./Composer";
import { EscalationCard } from "./EscalationCard";
import { RefusalCard } from "./RefusalCard";
import { SaveAnswerBar, type InitialSave } from "./SaveAnswerBar";
import { TriageCard } from "./TriageCard";
import {
  parseAssistantText,
  type Paragraph,
  type Segment,
} from "@/lib/conversation/render-citations";

export type ThreadMessage =
  | {
      id: string;
      role: "user";
      content: string;
      createdAt: string;
    }
  | {
      id: string;
      role: "assistant";
      content: string;
      citations: Citation[];
      refusal: RefusalReason | null;
      createdAt: string;
    };

type Pending =
  | { kind: "idle" }
  | { kind: "sending"; userText: string }
  | { kind: "error"; message: string; userText: string };

export function ConversationThread({
  conversationId,
  initialMessages,
  initialSaves,
  autoSubmit,
}: Readonly<{
  conversationId: string;
  initialMessages: ThreadMessage[];
  /**
   * Saved rows for this conversation (message-level bookmarks). Drives
   * initial "Saved" + note state per assistant turn.
   */
  initialSaves: ReadonlyArray<{
    messageId: string;
    saveId: string;
    note: string | null;
  }>;
  autoSubmit?: string | undefined;
}>) {
  const router = useRouter();
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [pending, setPending] = useState<Pending>({ kind: "idle" });
  const saveByMessage = useMemo(() => {
    const m = new Map<string, { saveId: string; note: string | null }>();
    for (const s of initialSaves) {
      m.set(s.messageId, { saveId: s.saveId, note: s.note });
    }
    return m;
  }, [initialSaves]);
  const onSaveMutate = useCallback(() => {
    router.refresh();
  }, [router]);

  useLayoutEffect(() => {
    const hash = window.location.hash;
    if (hash?.startsWith("#message-")) {
      const el = document.getElementById(hash.slice(1));
      el?.scrollIntoView({ block: "center" });
    }
  }, [messages.length, conversationId]);

  const onSubmit = useCallback(
    async (text: string) => {
      setPending({ kind: "sending", userText: text });
      try {
        const res = await fetch(`/api/app/conversation/${conversationId}/message`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
        }
        const data = (await res.json()) as {
          user: ThreadMessage;
          assistant: ThreadMessage;
        };
        setMessages((prev) => [...prev, data.user, data.assistant]);
        setPending({ kind: "idle" });
        // Refresh recent-conversations / greeting on the home screen on
        // back-nav. No-op on the conversation route itself (cache: stale).
        router.refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Network error";
        setPending({ kind: "error", message, userText: text });
      }
    },
    [conversationId, router],
  );

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && m.role === "assistant") return m.id;
    }
    return null;
  }, [messages]);

  return (
    <div className="space-y-6">
      <div className="space-y-6" data-testid="thread-messages">
        {messages.map((m) =>
          m.role === "user" ? (
            <div
              className="scroll-mt-24"
              data-turn="user"
              id={`message-${m.id}`}
              key={m.id}
            >
              <UserBubble message={m} />
            </div>
          ) : (
            <div
              className="scroll-mt-24"
              data-turn="assistant"
              id={`message-${m.id}`}
              key={m.id}
            >
              <AssistantBubble
                drivesCrisisStrip={m.id === lastAssistantId}
                initialSave={saveByMessage.get(m.id) ?? null}
                message={m}
                onSaveMutate={onSaveMutate}
              />
            </div>
          ),
        )}
        {pending.kind === "sending" ? (
          <>
            <div
              className="scroll-mt-24"
              data-turn="user"
              id="message-pending-user"
            >
              <UserBubble
                message={{
                  id: "pending-user",
                  role: "user",
                  content: pending.userText,
                  createdAt: new Date().toISOString(),
                }}
              />
            </div>
            <AssistantPending />
          </>
        ) : null}
        {pending.kind === "error" ? (
          <div
            className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
            data-testid="composer-error"
            role="alert"
          >
            <p>Couldn’t send that message — {pending.message}.</p>
            <button
              className="mt-2 text-accent underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => {
                void onSubmit(pending.userText);
              }}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : null}
      </div>
      <div className="sticky bottom-4">
        <Composer
          autoSubmitText={autoSubmit}
          onSubmit={onSubmit}
          pending={pending.kind === "sending"}
          placeholder="Ask a follow-up…"
        />
      </div>
    </div>
  );
}

function UserBubble({ message }: Readonly<{ message: Extract<ThreadMessage, { role: "user" }> }>) {
  return (
    <div className="flex justify-end" data-role="user">
      <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-accent/10 px-4 py-3 text-base text-foreground">
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  drivesCrisisStrip,
  initialSave,
  onSaveMutate,
}: Readonly<{
  message: Extract<ThreadMessage, { role: "assistant" }>;
  drivesCrisisStrip: boolean;
  initialSave: { saveId: string; note: string | null } | null;
  onSaveMutate: () => void;
}>) {
  if (message.refusal) {
    return (
      <div data-role="assistant" data-testid="assistant-refusal">
        {message.refusal.code === "safety_triaged" && message.refusal.script ? (
          <EscalationCard
            drivesCrisisStrip={drivesCrisisStrip}
            reason={
              message.refusal as SafetyTriageReason & {
                script: NonNullable<SafetyTriageReason["script"]>;
              }
            }
          />
        ) : message.refusal.code === "safety_triaged" ? (
          <TriageCard drivesCrisisStrip={drivesCrisisStrip} reason={message.refusal} />
        ) : (
          <RefusalCard reason={message.refusal} />
        )}
      </div>
    );
  }
  return (
    <AnsweredAssistant
      citations={message.citations}
      content={message.content}
      initialSave={initialSave}
      messageId={message.id}
      onSaveMutate={onSaveMutate}
    />
  );
}

function AnsweredAssistant({
  content,
  citations,
  messageId,
  initialSave,
  onSaveMutate,
}: Readonly<{
  content: string;
  citations: Citation[];
  messageId: string;
  initialSave: { saveId: string; note: string | null } | null;
  onSaveMutate: () => void;
}>) {
  const initial: InitialSave = initialSave
    ? { saveId: initialSave.saveId, note: initialSave.note }
    : null;
  const paragraphs = useMemo(
    () => parseAssistantText(content, citations),
    [content, citations],
  );
  return (
    <div
      className="space-y-4 text-base leading-relaxed text-foreground"
      data-role="assistant"
      data-testid="assistant-answered"
    >
      {paragraphs.map((para, i) => (
        <ParagraphBlock key={i} citations={citations} paragraph={para} />
      ))}
      <SaveAnswerBar initial={initial} messageId={messageId} onMutate={onSaveMutate} />
    </div>
  );
}

function ParagraphBlock({
  paragraph,
  citations,
}: Readonly<{
  paragraph: Paragraph;
  citations: Citation[];
}>) {
  const reactId = useId();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const expansionId = `${reactId}-expansion`;

  return (
    <div>
      <p className="whitespace-pre-wrap">
        {paragraph.segments.map((seg, i) => (
          <SegmentNode
            controlsId={expansionId}
            key={i}
            onToggle={(citationIdx) =>
              setOpenIdx((prev) => (prev === citationIdx ? null : citationIdx))
            }
            openIdx={openIdx}
            segment={seg}
          />
        ))}
      </p>
      {openIdx !== null && citations[openIdx] ? (
        <CitationExpansion citation={citations[openIdx]} id={expansionId} />
      ) : null}
    </div>
  );
}

function SegmentNode({
  segment,
  openIdx,
  onToggle,
  controlsId,
}: Readonly<{
  segment: Segment;
  openIdx: number | null;
  onToggle: (citationIdx: number) => void;
  controlsId: string;
}>) {
  if (segment.kind === "text") {
    return <span>{segment.text}</span>;
  }
  return (
    <CitationChip
      controlsId={controlsId}
      displayNumber={segment.displayNumber}
      expanded={openIdx === segment.citationIndex}
      onToggle={() => onToggle(segment.citationIndex)}
    />
  );
}

function AssistantPending() {
  return (
    <div className="text-sm text-muted-foreground" data-testid="assistant-pending">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        Thinking…
      </span>
    </div>
  );
}
