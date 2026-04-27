import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@alongside/db";

import { getSession } from "@/lib/auth/session";
import { careProfileToStageSnapshot } from "@/lib/onboarding/care-profile-stage-snapshot";
import { inferInferredStage } from "@/lib/onboarding/stage";
import { loadProfileBundle } from "@/lib/onboarding/status";
import { loadModuleBySlug } from "@/lib/library/load-module";
import { serverEnv, streamingLessonsEnabled } from "@/lib/env.server";
import { streamLessonCards } from "@/lib/lesson/slice-stream";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/lesson/[slug]
 * - `Accept: text/event-stream` + `STREAMING_LESSONS=1` (server): SSE (TASK-040). Deprecation: none — new route.
 * - `Accept: application/json` (or default): one-shot JSON for back-compat / tools. **Deprecated** for the interactive
 *   app once clients migrate; removal targeted Sprint 6 (TASK-040, aligned with TASK-031 §7).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const tPost = Date.now();
  const session = await getSession();
  if (session == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await context.params;
  const accept = request.headers.get("accept") ?? "";
  const wantsJson = accept.includes("application/json");
  const wantsSse = accept.includes("text/event-stream");
  const useSse = streamingLessonsEnabled() && wantsSse && !wantsJson;

  const mod = await loadModuleBySlug(slug);
  if (mod == null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { profile } = await loadProfileBundle(session.userId);
  const crFirstName = profile?.crFirstName?.trim() ?? null;
  const stage = profile ? inferInferredStage(careProfileToStageSnapshot(profile)) : null;

  if (useSse) {
    const encoder = new TextEncoder();
    const userId = session.userId;
    const moduleId = mod.id;
    const cardCount = 6;

    const logLine = (extra: Record<string, unknown>) => {
      console.log(
        JSON.stringify({
          "lesson.stream": true,
          module_id: moduleId,
          user_id: userId,
          ...extra,
        }),
      );
    };

    logLine({
      event: "started_at",
      ms_from_post: 0,
      // Picker + SRS are not on this read path; reserved for future same-route joins.
      picker_ms: null,
      srs_prefilter_ms: null,
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        let firstCardAt: number | null = null;
        let n = 0;
        try {
          send("started", { moduleId, cardCount });
          for await (const c of streamLessonCards(mod, crFirstName, stage)) {
            if (firstCardAt == null) {
              firstCardAt = Date.now();
              logLine({
                event: "first_card_at",
                ms_from_post: firstCardAt - tPost,
              });
            }
            send("card", { index: c.index, kind: c.kind, body_md: c.body_md });
            n += 1;
          }
          const doneAt = Date.now();
          logLine({
            event: "done_at",
            ms_from_post: doneAt - tPost,
            card_count: n,
          });
          send("done", { latencyMs: doneAt - tPost });
          if (firstCardAt != null) {
            const db = createDbClient(serverEnv.DATABASE_URL);
            const firstMs = firstCardAt - tPost;
            const doneMs = doneAt - tPost;
            await db.execute(sql`
              INSERT INTO lesson_stream_telemetry (user_id, module_id, first_card_ms, done_ms, card_count)
              VALUES (${userId}::uuid, ${mod.id}::uuid, ${firstMs}, ${doneMs}, ${n}::smallint)
            `);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "stream_failed";
          logLine({ event: "error", message: msg });
          send("error", { message: msg });
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

  return NextResponse.json(
    { mod, profile: { crFirstName, stage } },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Deprecated": "one-shot JSON is deprecated for interactive use (TASK-040). Prefer SSE or RSC when flags allow.",
      },
    },
  );
}
