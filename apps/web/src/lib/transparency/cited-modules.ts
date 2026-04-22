import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { conversations, createDbClient, messages, modules } from "@hypercare/db";

export type CitedModuleRow = {
  moduleSlug: string;
  title: string;
  citationCount: number;
  lastCitedAt: string;
};

type CitationJson = { moduleSlug?: string };

function slugsFromCitations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const c of raw) {
    if (c && typeof c === "object" && "moduleSlug" in c && typeof (c as CitationJson).moduleSlug === "string") {
      out.push((c as CitationJson).moduleSlug!);
    }
  }
  return out;
}

/** Distinct published modules cited on assistant turns in the last `days` days. */
export async function loadCitedModulesForUser(
  databaseUrl: string,
  userId: string,
  days: number,
): Promise<CitedModuleRow[]> {
  const db = createDbClient(databaseUrl);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      citations: messages.citations,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        eq(messages.role, "assistant"),
        gte(messages.createdAt, since),
        sql`jsonb_array_length(${messages.citations}) > 0`,
      ),
    )
    .orderBy(desc(messages.createdAt));

  const bySlug = new Map<string, { count: number; lastAt: Date }>();
  for (const r of rows) {
    for (const slug of slugsFromCitations(r.citations)) {
      const cur = bySlug.get(slug);
      const at = r.createdAt;
      if (cur == null) {
        bySlug.set(slug, { count: 1, lastAt: at });
      } else {
        cur.count += 1;
        if (at > cur.lastAt) cur.lastAt = at;
      }
    }
  }
  if (bySlug.size === 0) return [];

  const slugList = [...bySlug.keys()];
  const modRows = await db
    .select({ slug: modules.slug, title: modules.title })
    .from(modules)
    .where(inArray(modules.slug, slugList));

  const titles = new Map(modRows.map((m) => [m.slug, m.title]));

  const out: CitedModuleRow[] = slugList.map((moduleSlug) => {
    const agg = bySlug.get(moduleSlug)!;
    return {
      moduleSlug,
      title: titles.get(moduleSlug) ?? moduleSlug,
      citationCount: agg.count,
      lastCitedAt: agg.lastAt.toISOString(),
    };
  });
  out.sort((a, b) => b.citationCount - a.citationCount || a.title.localeCompare(b.title));
  return out;
}
