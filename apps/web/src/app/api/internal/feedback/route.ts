import { and, desc, eq, ilike, lt, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createDbClient, userFeedback, users } from "@alongside/db";

import { anonymizedHandle } from "@/lib/feedback/anon-handle";
import { requireInternalAdminApi } from "@/lib/internal/require-admin";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

const qSchema = z.object({
  state: z.string().optional(),
  kind: z.string().optional(),
  q: z.string().optional(),
  priority: z.enum(["high", "normal", "all"]).optional().default("all"),
  cursor: z.string().optional(),
});

const PAGE = 25;

function decodeCursor(raw: string | undefined): { at: string; id: string } | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      at?: string;
      id?: string;
    };
    if (typeof j.at === "string" && typeof j.id === "string") {
      return { at: j.at, id: j.id };
    }
  } catch {
    return null;
  }
  return null;
}

function encodeCursor(at: Date, id: string): string {
  return Buffer.from(JSON.stringify({ at: at.toISOString(), id }), "utf8").toString("base64url");
}

export async function GET(request: Request) {
  const auth = await requireInternalAdminApi();
  if (!auth.ok) {
    return auth.response;
  }
  const url = new URL(request.url);
  const parsed = qSchema.safeParse({
    state: url.searchParams.get("state") ?? undefined,
    kind: url.searchParams.get("kind") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    priority: url.searchParams.get("priority") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query", details: parsed.error.flatten() }, { status: 400 });
  }
  const q = parsed.data;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const cur = decodeCursor(q.cursor);

  const conds = [];
  if (q.state && q.state.length > 0) {
    conds.push(eq(userFeedback.triageState, q.state));
  }
  if (q.kind && q.kind.length > 0) {
    conds.push(eq(userFeedback.kind, q.kind));
  }
  if (q.priority === "high") {
    conds.push(eq(userFeedback.triagePriority, "high"));
  } else if (q.priority === "normal") {
    conds.push(eq(userFeedback.triagePriority, "normal"));
  }
  if (q.q && q.q.trim().length > 0) {
    const needle = `%${q.q.trim()}%`;
    conds.push(or(ilike(userFeedback.body, needle), ilike(userFeedback.resolutionNote, needle))!);
  }
  if (cur) {
    const t = new Date(cur.at);
    conds.push(
      or(
        lt(userFeedback.submittedAt, t),
        and(eq(userFeedback.submittedAt, t), lt(userFeedback.id, cur.id)),
      )!,
    );
  }

  const whereExpr = conds.length > 0 ? and(...conds) : undefined;
  const base = db
    .select({
      id: userFeedback.id,
      submittedAt: userFeedback.submittedAt,
      kind: userFeedback.kind,
      body: userFeedback.body,
      triageState: userFeedback.triageState,
      triagePriority: userFeedback.triagePriority,
      userId: userFeedback.userId,
      displayName: users.displayName,
    })
    .from(userFeedback)
    .innerJoin(users, eq(userFeedback.userId, users.id));
  const rows = await (whereExpr != null ? base.where(whereExpr) : base)
    .orderBy(desc(userFeedback.submittedAt), desc(userFeedback.id))
    .limit(PAGE + 1);

  const hasMore = rows.length > PAGE;
  const pageRows = hasMore ? rows.slice(0, PAGE) : rows;
  const last = pageRows[pageRows.length - 1];
  const next_cursor =
    hasMore && last
      ? encodeCursor(last.submittedAt, last.id)
      : null;

  return NextResponse.json({
    items: pageRows.map((r) => ({
      id: r.id,
      submitted_at: r.submittedAt.toISOString(),
      kind: r.kind,
      body_preview:
        r.body == null || r.body.length === 0
          ? "(no body — thumbs-down)"
          : r.body.length > 120
            ? `${r.body.slice(0, 120)}…`
            : r.body,
      triage_state: r.triageState,
      triage_priority: r.triagePriority,
      user_label: anonymizedHandle(r.displayName, r.userId),
    })),
    next_cursor,
  });
}
