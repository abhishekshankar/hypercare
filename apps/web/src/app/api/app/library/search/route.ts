import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  createDbClient,
  librarySearchStreams,
  loadLibrarySearchCandidates,
  normalizeLibrarySearchQuery,
  rankLibrarySearchMatches,
  type LibrarySearchCandidate,
} from "@alongside/db";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { serverEnv, streamingLibraryEnabled } from "@/lib/env.server";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  query: z.string().max(500),
});

function logSearch(event: string, fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      "library.search": true,
      event,
      ...fields,
    }),
  );
}

/**
 * POST /api/app/library/search — SSE library substring search (TASK-041).
 * Requires both STREAMING_LIBRARY flags on the server; otherwise 404.
 */
export async function POST(request: Request) {
  if (!streamingLibraryEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("text/event-stream")) {
    return NextResponse.json({ error: "accept_text_event_stream_required" }, { status: 406 });
  }

  const session = await getSession();
  if (session == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.flatten() }, { status: 400 });
  }

  const rawQ = parsed.data.query;
  const query = normalizeLibrarySearchQuery(rawQ);
  if (query.length === 0) {
    return NextResponse.json({ error: "empty_query" }, { status: 400 });
  }

  const postReceiptMs = Date.now();
  const userId = session.userId;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const { candidates, meta } = await loadLibrarySearchCandidates(db, userId);
  const ranked = rankLibrarySearchMatches(candidates, query);

  logSearch("library.search.started_at", {
    user_id: userId,
    query_length: query.length,
    candidate_count: meta.candidateCount,
  });

  const [telemetryRow] = await db
    .insert(librarySearchStreams)
    .values({
      userId,
      queryLength: query.length,
      candidateCount: meta.candidateCount,
      resultCount: 0,
    })
    .returning({ id: librarySearchStreams.id });

  const streamId = telemetryRow?.id ?? null;

  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      let firstResultLogged = false;
      let n = 0;
      try {
        send("started", { query, candidateCount: meta.candidateCount });

        for (const row of ranked) {
          const hit = row as LibrarySearchCandidate & { score: number };
          if (signal.aborted) {
            break;
          }
          if (!firstResultLogged) {
            firstResultLogged = true;
            logSearch("library.search.first_result_at", {
              user_id: userId,
              query_length: query.length,
              candidate_count: meta.candidateCount,
            });
            if (streamId != null) {
              await db
                .update(librarySearchStreams)
                .set({ firstResultAt: new Date() })
                .where(eq(librarySearchStreams.id, streamId));
            }
          }

          send("result", {
            id: hit.id,
            kind: hit.kind,
            title: hit.title,
            snippet: hit.snippet,
            score: hit.score,
            source: hit.source,
            conversationId: hit.conversationId ?? null,
            messageId: hit.messageId ?? null,
            module: hit.module ?? null,
          });
          n += 1;
          await new Promise<void>((resolve) => {
            queueMicrotask(() => resolve());
          });
        }

        const doneAt = Date.now();
        const latencyMs = doneAt - postReceiptMs;
        logSearch("library.search.done_at", {
          user_id: userId,
          query_length: query.length,
          candidate_count: meta.candidateCount,
          result_count: n,
        });

        send("done", { latencyMs, resultCount: n });

        if (streamId != null) {
          await db
            .update(librarySearchStreams)
            .set({ doneAt: new Date(), resultCount: n })
            .where(eq(librarySearchStreams.id, streamId));
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "stream_failed";
        logSearch("library.search.error", {
          user_id: userId,
          query_length: query.length,
          candidate_count: meta.candidateCount,
          message,
        });
        send("error", { message });
        if (streamId != null) {
          await db
            .update(librarySearchStreams)
            .set({ doneAt: new Date(), resultCount: n })
            .where(eq(librarySearchStreams.id, streamId));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}
