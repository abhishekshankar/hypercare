import { and, eq, ne } from "drizzle-orm";

import { getCareProfileForUser, type DbWithSchema } from "../queries/care-profile.js";
import {
  conversations,
  messages,
  moduleTopics,
  modules,
  savedAnswers,
  topics,
} from "../schema/index.js";
import type { LibrarySearchCandidate } from "./library-search-types.js";

function moduleHaystack(topicTags: { displayName: string }[], title: string, summary: string): string {
  const topicNames = topicTags.map((t) => t.displayName).join(" ");
  return `${title} ${summary} ${topicNames}`.toLowerCase();
}

/**
 * Published modules in library shape (TASK-023 / load-list parity).
 * v1: full catalog is indexed for search (profile-level bookmarks table is future work; TASK-038 care_profile_id
 * is resolved for metrics / follow-up bookmark scoping).
 */
export async function loadPublishedModuleSearchCandidates(db: DbWithSchema): Promise<LibrarySearchCandidate[]> {
  const rows = await db
    .select({
      m: modules,
      topicSlug: moduleTopics.topicSlug,
      topicDisplay: topics.displayName,
    })
    .from(modules)
    .leftJoin(moduleTopics, eq(modules.id, moduleTopics.moduleId))
    .leftJoin(topics, eq(moduleTopics.topicSlug, topics.slug))
    .where(and(eq(modules.published, true), ne(modules.draftStatus, "retired")));

  const bySlug = new Map<
    string,
    {
      m: (typeof rows)[0]["m"];
      topicTags: { slug: string; displayName: string }[];
    }
  >();

  for (const r of rows) {
    const slug = r.m.slug;
    if (!bySlug.has(slug)) {
      bySlug.set(slug, { m: r.m, topicTags: [] });
    }
    if (r.topicSlug && r.topicDisplay) {
      const entry = bySlug.get(slug)!;
      if (!entry.topicTags.some((t) => t.slug === r.topicSlug)) {
        entry.topicTags.push({ slug: r.topicSlug, displayName: r.topicDisplay });
      }
    }
  }

  const out: LibrarySearchCandidate[] = [];
  for (const { m, topicTags } of bySlug.values()) {
    const title = m.title;
    const summary = m.summary;
    const haystack = moduleHaystack(topicTags, title, summary);
    out.push({
      kind: "bookmarked_module",
      id: m.slug,
      title,
      snippet: summary,
      haystack,
      source: "published_catalog",
      module: {
        slug: m.slug,
        title,
        summary,
        category: m.category,
        stageRelevance: m.stageRelevance,
        topicTags,
      },
    });
  }
  return out;
}

/** Saved assistant answers for this user only (TASK-038: not shared across co-caregivers). */
export async function loadSavedAnswerSearchCandidates(
  db: DbWithSchema,
  userId: string,
): Promise<LibrarySearchCandidate[]> {
  const rows = await db
    .select({
      saveId: savedAnswers.id,
      messageId: messages.id,
      note: savedAnswers.note,
      content: messages.content,
      title: conversations.title,
      conversationId: conversations.id,
    })
    .from(savedAnswers)
    .innerJoin(messages, eq(savedAnswers.messageId, messages.id))
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(savedAnswers.userId, userId),
        eq(messages.role, "assistant"),
        eq(conversations.userId, userId),
      ),
    );

  const out: LibrarySearchCandidate[] = [];
  for (const r of rows) {
    const title = (r.title?.trim() ?? "").length > 0 ? r.title!.trim() : "Saved answer";
    const body = r.content.trim();
    const note = r.note?.trim() ?? "";
    const snippet = body.length > 220 ? `${body.slice(0, 220).trimEnd()}…` : body;
    const haystack = `${title} ${body} ${note}`.toLowerCase();
    out.push({
      kind: "saved_answer",
      id: r.saveId,
      title,
      snippet,
      haystack,
      source: "saved_answer",
      conversationId: r.conversationId,
      messageId: r.messageId,
    });
  }
  return out;
}

export type LibrarySearchCandidateSetMeta = {
  careProfileId: string | null;
  candidateCount: number;
};

/**
 * Full candidate set for library search: per-user saves + published modules.
 * `recent_topic` rows are reserved for a future signal; v1 returns none.
 *
 * TASK-038: resolves active `care_profile_id` via `care_profile_members` for downstream bookmark filtering;
 * v1 module list remains the published catalog (see ADR 0029).
 */
export async function loadLibrarySearchCandidates(
  db: DbWithSchema,
  userId: string,
): Promise<{ candidates: LibrarySearchCandidate[]; meta: LibrarySearchCandidateSetMeta }> {
  const bundle = await getCareProfileForUser(db, userId);
  const careProfileId = bundle?.profile.id ?? null;

  const [mods, saves] = await Promise.all([
    loadPublishedModuleSearchCandidates(db),
    loadSavedAnswerSearchCandidates(db, userId),
  ]);

  const candidates: LibrarySearchCandidate[] = [...mods, ...saves];
  return {
    candidates,
    meta: {
      careProfileId,
      candidateCount: candidates.length,
    },
  };
}
