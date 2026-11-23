"use client";

import { useCallback, useEffect, useState } from "react";

import type { RetentionSummaryRow } from "@/lib/privacy/retention-summary";

type SessionRow = {
  sessionId: string;
  lastSeenAt: string;
  countryCode: string | null;
  current: boolean;
};

type Props = {
  userEmail: string;
  retentionRows: RetentionSummaryRow[];
};

export function PrivacyAndDataSection({ userEmail, retentionRows }: Props) {
  const [exportState, setExportState] = useState<"idle" | "preparing" | "ready" | "error">("idle");
  const [exportId, setExportId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/app/privacy/sessions", { method: "GET" });
    if (res.ok) {
      const j = (await res.json()) as { sessions: SessionRow[] };
      setSessions(j.sessions);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const onDownload = async () => {
    setExportState("preparing");
    setExportErr(null);
    setDownloadUrl(null);
    try {
      const post = await fetch("/api/app/privacy/export", { method: "POST" });
      if (post.status === 429) {
        setExportErr("You can request one export per 24 hours.");
        setExportState("error");
        return;
      }
      if (post.status === 503) {
        setExportErr("Export is not configured in this environment.");
        setExportState("error");
        return;
      }
      if (!post.ok) {
        setExportErr("Could not start export.");
        setExportState("error");
        return;
      }
      const { exportId: id } = (await post.json()) as { exportId: string };
      setExportId(id);
      for (let i = 0; i < 40; i++) {
        const st = await fetch(`/api/app/privacy/export/status?exportId=${encodeURIComponent(id)}`, {
          method: "GET",
        });
        const body = (await st.json()) as
          | { status: "complete"; downloadUrl: string }
          | { status: "error"; error: string }
          | { error?: string };
        if (st.ok && "status" in body) {
          if (body.status === "complete" && "downloadUrl" in body) {
            setDownloadUrl(body.downloadUrl);
            setExportState("ready");
            return;
          }
          if (body.status === "error") {
            setExportErr("error" in body ? String(body.error) : "error");
            setExportState("error");
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      setExportErr("Timed out. Try again in a minute.");
      setExportState("error");
    } catch {
      setExportErr("Request failed.");
      setExportState("error");
    }
  };

  const onRevoke = async (sessionId: string) => {
    const res = await fetch("/api/app/privacy/sessions/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (res.ok) {
      void loadSessions();
    }
  };

  const onDelete = async () => {
    if (deleteInput.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      return;
    }
    const res = await fetch("/api/app/privacy/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail }),
    });
    if (res.ok) {
      const j = (await res.json()) as { redirect?: string };
      window.location.href = j.redirect ?? "/?deleted=1";
    }
  };

  return (
    <section className="space-y-8 border-t border-border pt-8">
      <h2 className="text-lg font-medium text-foreground">Privacy & your data</h2>
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">What we keep, and for how long</h3>
        <p className="text-sm text-muted-foreground">
          This is a human-readable summary. Technical detail is in the product documents (retention
          policy).
        </p>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-2 font-medium">Area</th>
                <th className="p-2 font-medium">Retention</th>
              </tr>
            </thead>
            <tbody>
              {retentionRows.map((row, idx) => (
                <tr key={`${row.label}-${String(idx)}`} className="border-b border-border/60">
                  <td className="p-2 text-foreground">{row.label}</td>
                  <td className="p-2 text-muted-foreground">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Download my data</h3>
        <p className="text-sm text-muted-foreground">
          We will prepare a ZIP of your data on this page. You can request a download at most once
          every 24 hours.
        </p>
        {exportState === "preparing" ? (
          <p className="text-sm text-foreground" role="status">
            We&apos;re preparing your data. This can take a minute. Keep this page open.
            {exportId != null ? ` (request ${exportId.slice(0, 8)}…)` : null}
          </p>
        ) : null}
        {exportState === "ready" && downloadUrl != null ? (
          <a
            className="inline-flex text-sm text-accent underline-offset-2 hover:underline"
            href={downloadUrl}
            rel="noreferrer"
          >
            Download your export
          </a>
        ) : null}
        {exportErr != null ? <p className="text-sm text-destructive">{exportErr}</p> : null}
        <button
          className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground"
          onClick={onDownload}
          type="button"
        >
          {exportState === "preparing" ? "Preparing…" : "Download my data"}
        </button>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Sign-in devices</h3>
        <p className="text-sm text-muted-foreground">Country and last seen (we do not show full IP).</p>
        {sessions == null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active device rows yet. Sign in again after deploy.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {sessions.map((s) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                key={s.sessionId}
              >
                <span className="text-foreground">
                  {s.current ? "This device" : "Other device"}{" "}
                  {s.countryCode != null && s.countryCode.length > 0
                    ? `· ${s.countryCode}`
                    : "· Country unknown"}
                  {" · "}
                  last seen {new Date(s.lastSeenAt).toLocaleString()}
                </span>
                {!s.current ? (
                  <button
                    className="text-xs text-muted-foreground underline"
                    onClick={() => onRevoke(s.sessionId)}
                    type="button"
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Delete my account</h3>
        <p className="text-sm text-muted-foreground">
          This removes your care profile, conversations, saved answers, lesson progress, and
          check-ins. Anonymized safety flags are kept for up to two years for clinician review; they
          are no longer linked to you. This cannot be undone.
        </p>
        {deleteOpen ? (
          <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-foreground">
              This deletes your care profile, conversations, saved answers, lesson progress, and
              check-ins. Anonymized safety flags from your conversations are kept for two years so
              clinicians can review and improve crisis response. Those rows are no longer linked to
              you: they keep category, message text, and time — not your identity. This cannot be
              undone.
            </p>
            <label className="block text-sm" htmlFor="delete-confirm">
              Type your email to confirm
            </label>
            <input
              autoComplete="off"
              className="w-full max-w-md rounded border border-border bg-background px-2 py-1.5 text-sm"
              id="delete-confirm"
              onChange={(e) => setDeleteInput(e.target.value)}
              type="email"
              value={deleteInput}
            />
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-40"
                disabled={deleteInput.trim().toLowerCase() !== userEmail.trim().toLowerCase()}
                onClick={onDelete}
                type="button"
              >
                Permanently delete
              </button>
              <button
                className="rounded-md border border-border px-3 py-2 text-sm"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteInput("");
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="text-sm text-destructive underline-offset-2 hover:underline"
            onClick={() => setDeleteOpen(true)}
            type="button"
          >
            Delete my account
          </button>
        )}
      </div>
    </section>
  );
}
