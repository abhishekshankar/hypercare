import { desc, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createDbClient, modules } from "@alongside/db";

import { requireInternalAdminApi } from "@/lib/internal/require-admin";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireInternalAdminApi();
  if (!auth.ok) {
    return auth.response;
  }
  const url = new URL(request.url);
  const q = z.string().min(1).max(200).safeParse(url.searchParams.get("q") ?? "");
  if (!q.success) {
    return NextResponse.json({ items: [] });
  }
  const needle = `%${q.data.trim()}%`;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const rows = await db
    .select({
      id: modules.id,
      slug: modules.slug,
      title: modules.title,
    })
    .from(modules)
    .where(or(ilike(modules.title, needle), ilike(modules.slug, needle)))
    .orderBy(desc(modules.published), desc(modules.id))
    .limit(20);
  return NextResponse.json({ items: rows });
}
