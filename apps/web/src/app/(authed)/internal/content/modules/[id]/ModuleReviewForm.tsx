"use client";

import { useState } from "react";

export function ModuleReviewForm(props: { moduleId: string }) {
  const [verdict, setVerdict] = useState<"approve" | "reject" | "request_changes">("approve");
  const [comments, setComments] = useState("");
  const [reviewRole, setReviewRole] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="max-w-lg space-y-2">
      <label className="text-xs font-medium text-neutral-600">Verdict</label>
      <select
        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        value={verdict}
        onChange={(e) => setVerdict(e.target.value as "approve" | "reject" | "request_changes")}
      >
        <option value="approve">approve</option>
        <option value="request_changes">request_changes</option>
        <option value="reject">reject</option>
      </select>
      <label className="text-xs font-medium text-neutral-600">Comments (markdown)</label>
      <textarea
        className="h-32 w-full rounded border border-neutral-300 p-2 text-sm"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
      />
      <p className="text-xs text-neutral-500">
        Admin: pick explicit review role if you are not mapped automatically.
      </p>
      <input
        className="w-full rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
        placeholder="reviewRole (admin only): e.g. domain_sme"
        value={reviewRole}
        onChange={(e) => setReviewRole(e.target.value)}
      />
      <button
        type="button"
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white"
        onClick={async () => {
          setMsg(null);
          const res = await fetch(`/api/internal/content/modules/${props.moduleId}/review`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              verdict,
              commentsMd: comments || null,
              reviewRole: reviewRole || undefined,
            }),
          });
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: unknown };
            setMsg(res.status + " " + JSON.stringify(j));
          } else {
            setMsg("Review recorded.");
          }
        }}
      >
        Submit
      </button>
      {msg && <p className="text-sm text-neutral-600">{msg}</p>}
    </div>
  );
}
