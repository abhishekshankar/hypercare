import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { decodeSaveListCursor } from "@/lib/saved/cursor";
import {
  createSavedAnswer,
  listSavedAnswers,
  MessageNotFoundError,
  SaveNotAllowedError,
} from "@/lib/saved/service";

export const dynamic = "force-dynamic";

const PostBody = z.object({
  message_id: z.string().uuid(),
  note: z.string().max(240).optional(),
});

const GetQuery = z.object({
  q: z.string().max(2000).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().max(10_000).optional(),
});

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const parsed = GetQuery.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query", issues: parsed.error.flatten() }, { status: 400 });
  }
  const limit = parsed.data.limit ?? 20;
  const cursor = decodeSaveListCursor(parsed.data.cursor);
  if (parsed.data.cursor && !cursor) {
    return NextResponse.json({ error: "invalid_cursor" }, { status: 400 });
  }
  const { items, nextCursor } = await listSavedAnswers({
    userId: session.userId,
    q: parsed.data.q ?? null,
    limit,
    cursor,
  });
  return NextResponse.json({ items, nextCursor });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = PostBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const r = await createSavedAnswer({
      userId: session.userId,
      messageId: parsed.data.message_id,
      note: parsed.data.note ?? null,
    });
    if (r.kind === "duplicate") {
      return NextResponse.json({ id: r.id, duplicate: true }, { status: 409 });
    }
    return NextResponse.json({ id: r.id }, { status: 201 });
  } catch (e) {
    if (e instanceof MessageNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (e instanceof SaveNotAllowedError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
