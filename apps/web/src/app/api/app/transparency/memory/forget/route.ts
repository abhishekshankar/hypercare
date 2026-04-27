import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { loadConversationOwned } from "@/lib/conversation/persist";
import { serverEnv } from "@/lib/env.server";
import {
  logTransparencyUserAction,
  TRANSPARENCY_FORGET_ACTION,
} from "@/lib/transparency/user-actions";
import { conversationMemoryForgotten, createDbClient } from "@alongside/db";

export const dynamic = "force-dynamic";

const Body = z.object({
  conversationId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
});

async function trimForgottenToMax29(
  db: ReturnType<typeof createDbClient>,
  conversationId: string,
  userId: string,
): Promise<void> {
  const rows = await db
    .select({ id: conversationMemoryForgotten.id })
    .from(conversationMemoryForgotten)
    .where(
      and(
        eq(conversationMemoryForgotten.conversationId, conversationId),
        eq(conversationMemoryForgotten.userId, userId),
      ),
    )
    .orderBy(asc(conversationMemoryForgotten.forgottenAt));
  if (rows.length < 30) return;
  const dropCount = rows.length - 29;
  const ids = rows.slice(0, dropCount).map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(conversationMemoryForgotten).where(inArray(conversationMemoryForgotten.id, ids));
  }
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
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.flatten() }, { status: 400 });
  }
  const owned = await loadConversationOwned(parsed.data.conversationId, session.userId);
  if (!owned) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const db = createDbClient(serverEnv.DATABASE_URL);
  await trimForgottenToMax29(db, parsed.data.conversationId, session.userId);
  const [row] = await db
    .insert(conversationMemoryForgotten)
    .values({
      conversationId: parsed.data.conversationId,
      userId: session.userId,
      forgottenText: parsed.data.text,
    })
    .returning({ id: conversationMemoryForgotten.id });

  await logTransparencyUserAction(serverEnv.DATABASE_URL, {
    userId: session.userId,
    action: TRANSPARENCY_FORGET_ACTION,
    path: "/api/app/transparency/memory/forget",
    meta: {
      conversationId: parsed.data.conversationId,
      forgottenId: row?.id,
      textLen: parsed.data.text.length,
    },
  });

  return NextResponse.json({ ok: true, id: row?.id });
}
