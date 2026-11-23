"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export function ModuleEditForm(props: { moduleId: string; initialBody: string; initialTitle: string }) {
  const [body, setBody] = useState(props.initialBody);
  const [title, setTitle] = useState(props.initialTitle);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <label className="text-xs font-medium text-neutral-600">Title</label>
        <input
          className="mb-2 w-full rounded border border-neutral-300 px-2 py-1 font-sans text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="text-xs font-medium text-neutral-600">Body (markdown)</label>
        <textarea
          className="h-[min(70vh,520px)] w-full rounded border border-neutral-300 p-2 font-mono text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="button"
          className="mt-2 rounded bg-neutral-900 px-3 py-1.5 text-sm text-white"
          onClick={async () => {
            setMsg(null);
            const res = await fetch(`/api/internal/content/modules/${props.moduleId}`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ bodyMd: body, title }),
            });
            if (!res.ok) {
              const j = (await res.json().catch(() => ({}))) as { error?: unknown };
              setMsg(res.status + " " + JSON.stringify(j));
            } else {
              setMsg("Saved.");
            }
          }}
        >
          Save
        </button>
        {msg && <p className="mt-2 text-sm text-neutral-600">{msg}</p>}
      </div>
      <div>
        <h2 className="text-sm font-medium">Preview</h2>
        <div className="prose prose-sm mt-1 max-w-none rounded border border-neutral-200 p-3">
          <ReactMarkdown>{body || "_Empty_"}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
