"use client";

import { useCallback, useEffect, useState } from "react";

type ListItem = {
  id: string;
  submitted_at: string;
  kind: string;
  body_preview: string;
  triage_state: string;
  triage_priority: string;
  user_label: string;
};

type Detail = {
  feedback: {
    id: string;
    kind: string;
    body: string | null;
    triage_state: string;
    triage_priority: string;
    include_context: boolean;
    submitted_at: string;
    resolution_note: string | null;
    linked_module_id: string | null;
    linked_task_id: string | null;
    triaged_at: string | null;
    safety_relabel: string | null;
  };
  user_label: string;
  care: { inferred_stage: string | null } | null;
  weekly: { what_helped: string | null; tried_something: boolean | null; answered_at: string | null } | null;
  message: {
    id: string;
    content: string;
    created_at: string;
    refusal?: { code: string } | null;
  } | null;
  conversation_excerpt?: { id: string; messages: Array<{ id: string; role: string; content: string; created_at: string }> };
  safety_flags: Array<{ id: string; category: string; severity: string; created_at: string }>;
  linked_module: { id: string; slug: string; title: string } | null;
};

const SAFETY_RELABEL_OPTS = [
  "crisis_self_harm",
  "crisis_recipient_safety",
  "crisis_external",
  "gray_zone",
  "safe_self_care",
  "safe_factual",
] as const;

const STATE_OPTS = [
  "new",
  "reading",
  "needs_content_fix",
  "needs_classifier_fix",
  "needs_product_fix",
  "ack_and_close",
  "spam_or_invalid",
] as const;

export function FeedbackQueueClient() {
  const [stateFilter, setStateFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [q, setQ] = useState("");
  const [highOnly, setHighOnly] = useState(false);
  const [items, setItems] = useState<ListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [triageState, setTriageState] = useState<string>("new");
  const [resolution, setResolution] = useState("");
  const [taskId, setTaskId] = useState("");
  const [moduleQ, setModuleQ] = useState("");
  const [modulePick, setModulePick] = useState<{ id: string; slug: string; title: string }[]>([]);
  const [linkedModuleId, setLinkedModuleId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [safetyRelabel, setSafetyRelabel] = useState("");

  const buildParams = useCallback(
    (cursor: string | null) => {
      const params = new URLSearchParams();
      if (stateFilter) params.set("state", stateFilter);
      if (kindFilter) params.set("kind", kindFilter);
      if (q.trim()) params.set("q", q.trim());
      if (highOnly) params.set("priority", "high");
      if (cursor) params.set("cursor", cursor);
      return params;
    },
    [stateFilter, kindFilter, q, highOnly],
  );

  const fetchPage = useCallback(
    async (append: boolean, cursor: string | null) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/internal/feedback?${buildParams(cursor).toString()}`);
        const j = (await res.json()) as { items: ListItem[]; next_cursor: string | null };
        setItems((prev) => (append ? [...prev, ...j.items] : j.items));
        setNextCursor(j.next_cursor);
      } finally {
        setLoading(false);
      }
    },
    [buildParams],
  );

  useEffect(() => {
    void fetchPage(false, null);
    // Initial load only; use "Apply filters" to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected == null) {
      setDetail(null);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/internal/feedback/${selected}`);
      if (res.ok) {
        const d = (await res.json()) as Detail;
        setDetail(d);
        setTriageState(d.feedback.triage_state);
        setResolution(d.feedback.resolution_note ?? "");
        setTaskId(d.feedback.linked_task_id ?? "");
        setLinkedModuleId(d.feedback.linked_module_id);
        setSafetyRelabel(d.feedback.safety_relabel ?? "");
        setModuleQ(d.linked_module?.title ?? "");
        setModulePick([]);
      }
    })();
  }, [selected]);

  useEffect(() => {
    if (moduleQ.trim().length < 2) {
      setModulePick([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        const res = await fetch(`/api/internal/modules-search?q=${encodeURIComponent(moduleQ.trim())}`);
        const j = (await res.json()) as { items: { id: string; slug: string; title: string }[] };
        setModulePick(j.items);
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [moduleQ]);

  async function saveTriage() {
    if (selected == null || detail == null) return;
    setMsg(null);
    const showSafetyRelabel =
      detail.feedback.kind === "thumbs_down" &&
      (detail.safety_flags.length > 0 || detail.message?.refusal?.code === "safety_triaged");
    const res = await fetch(`/api/internal/feedback/${selected}/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        state: triageState,
        resolution_note: resolution,
        linked_module_id: linkedModuleId,
        linked_task_id: taskId.trim() || null,
        ...(showSafetyRelabel
          ? { safety_relabel: safetyRelabel.trim().length > 0 ? safetyRelabel : null }
          : {}),
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      setMsg(t);
      return;
    }
    setMsg("Saved.");
    void fetchPage(false, null);
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 lg:flex-row">
      <aside className="w-full space-y-3 lg:max-w-xs">
        <h2 className="text-sm font-semibold text-zinc-800">Filters</h2>
        <label className="block text-xs text-zinc-600">
          Triage state
          <select
            className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
            onChange={(e) => setStateFilter(e.target.value)}
            value={stateFilter}
          >
            <option value="">(any)</option>
            {STATE_OPTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-zinc-600">
          Kind
          <select
            className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
            onChange={(e) => setKindFilter(e.target.value)}
            value={kindFilter}
          >
            <option value="">(any)</option>
            <option value="off_reply">off_reply</option>
            <option value="not_found">not_found</option>
            <option value="suggestion">suggestion</option>
            <option value="other">other</option>
            <option value="thumbs_down">thumbs_down</option>
          </select>
        </label>
        <label className="block text-xs text-zinc-600">
          Search body / note
          <input
            className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
            onChange={(e) => setQ(e.target.value)}
            value={q}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <input checked={highOnly} onChange={(e) => setHighOnly(e.target.checked)} type="checkbox" />
          High priority only
        </label>
        <button
          className="text-sm text-violet-700 underline"
          onClick={() => void fetchPage(false, null)}
          type="button"
        >
          Apply filters
        </button>
      </aside>
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800">Queue</h2>
        {loading && items.length === 0 ? <p className="text-sm text-zinc-500">Loading…</p> : null}
        <ul className="divide-y divide-zinc-200 border border-zinc-200">
          {items.map((it) => (
            <li key={it.id}>
              <button
                className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 ${
                  selected === it.id ? "bg-zinc-100" : ""
                }`}
                onClick={() => setSelected(it.id)}
                type="button"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <span className="text-xs text-zinc-500">
                    {new Date(it.submitted_at).toLocaleString()} · {it.user_label}
                  </span>
                  <span
                    className={
                      it.triage_priority === "high" ? "text-xs font-medium text-amber-800" : "text-xs text-zinc-500"
                    }
                  >
                    {it.triage_state}
                    {it.triage_priority === "high" ? " · HIGH" : ""}
                  </span>
                </div>
                <p className="line-clamp-2 text-zinc-800">{it.body_preview}</p>
                <p className="text-xs text-zinc-500">{it.kind}</p>
              </button>
            </li>
          ))}
        </ul>
        {nextCursor != null && nextCursor.length > 0 ? (
          <button
            className="text-sm text-violet-700 underline"
            onClick={() => void fetchPage(true, nextCursor)}
            type="button"
          >
            Load more
          </button>
        ) : null}
      </div>
      <div className="w-full space-y-3 border-t border-zinc-200 pt-4 lg:max-w-md lg:border-l lg:pl-4 lg:pt-0">
        {detail == null ? (
          <p className="text-sm text-zinc-500">Select a row to review.</p>
        ) : (
          <>
            <h3 className="text-sm font-semibold">Detail</h3>
            <p className="text-xs text-zinc-600">
              {detail.user_label} · stage: {detail.care?.inferred_stage ?? "—"} · last check-in:{" "}
              {detail.weekly?.what_helped ?? "—"}
            </p>
            <div className="rounded border border-zinc-200 bg-white p-3 text-sm text-zinc-800">
              <p className="whitespace-pre-wrap">{detail.feedback.body ?? "—"}</p>
            </div>
            {detail.message != null ? (
              <div>
                <h4 className="text-xs font-medium text-zinc-600">Linked assistant message</h4>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-zinc-100 p-2 text-xs">
                  {detail.message.content}
                </pre>
              </div>
            ) : null}
            {detail.conversation_excerpt != null && detail.conversation_excerpt.messages.length > 0 ? (
              <details className="text-xs" open>
                <summary className="cursor-pointer text-violet-700">Conversation context</summary>
                <ol className="mt-2 max-h-56 space-y-1 overflow-auto pl-3">
                  {detail.conversation_excerpt.messages.map((m) => (
                    <li key={m.id}>
                      <span className="text-zinc-500">{m.role}:</span> {m.content.slice(0, 200)}
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
            {detail.safety_flags.length > 0 ? (
              <div>
                <h4 className="text-xs font-medium text-zinc-600">Safety flags (conversation)</h4>
                <ul className="text-xs text-zinc-700">
                  {detail.safety_flags.map((f) => (
                    <li key={f.id}>
                      {f.category} / {f.severity}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {detail.feedback.kind === "thumbs_down" &&
            (detail.safety_flags.length > 0 || detail.message?.refusal?.code === "safety_triaged") ? (
              <label className="block text-xs text-zinc-600">
                Safety re-label (training corpus, TASK-039)
                <select
                  className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
                  onChange={(e) => setSafetyRelabel(e.target.value)}
                  value={safetyRelabel}
                >
                  <option value="">(none)</option>
                  {SAFETY_RELABEL_OPTS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block text-xs text-zinc-600">
              Triage state
              <select
                className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
                onChange={(e) => setTriageState(e.target.value)}
                value={triageState}
              >
                {STATE_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-600">
              Resolution note
              <textarea
                className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
                onChange={(e) => setResolution(e.target.value)}
                rows={4}
                value={resolution}
              />
            </label>
            <label className="block text-xs text-zinc-600">
              Link module (search)
              <input
                className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
                onChange={(e) => setModuleQ(e.target.value)}
                value={moduleQ}
              />
            </label>
            {modulePick.length > 0 ? (
              <ul className="text-xs">
                {modulePick.map((m) => (
                  <li key={m.id}>
                    <button
                      className="text-violet-700 underline"
                      onClick={() => {
                        setLinkedModuleId(m.id);
                        setModuleQ(`${m.title} (${m.slug})`);
                        setModulePick([]);
                      }}
                      type="button"
                    >
                      {m.title} ({m.slug})
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {detail.linked_module != null && linkedModuleId === detail.linked_module.id ? (
              <p className="text-xs text-zinc-600">Linked: {detail.linked_module.title}</p>
            ) : linkedModuleId != null ? (
              <p className="text-xs text-zinc-600">Module id: {linkedModuleId}</p>
            ) : null}
            <label className="block text-xs text-zinc-600">
              Link TASK id (e.g. TASK-036)
              <input
                className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
                onChange={(e) => setTaskId(e.target.value)}
                value={taskId}
              />
            </label>
            {msg != null ? <p className="text-sm text-zinc-700">{msg}</p> : null}
            <button
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white"
              onClick={() => void saveTriage()}
              type="button"
            >
              Save triage
            </button>
          </>
        )}
      </div>
    </div>
  );
}
