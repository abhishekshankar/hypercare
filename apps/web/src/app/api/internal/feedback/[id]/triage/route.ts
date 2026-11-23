import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminAudit, createDbClient, modules, userFeedback } from "@alongside/db";

import { baseUrl } from "@/lib/env.server";
import { postSlackFeedbackMessage } from "@/lib/feedback/slack";
import { requireInternalAdminApi } from "@/lib/internal/require-admin";
import { serverEnv } from "@/lib/env.server";

const safetyRelabelEnum = z.enum([
  "crisis_self_harm",
  "crisis_recipient_safety",
  "crisis_external",
  "gray_zone",
  "safe_self_care",
  "safe_factual",
]);

const triageBody = z.object({
  state: z.enum([
    "new",
    "reading",
    "needs_content_fix",
    "needs_classifier_fix",
    "needs_product_fix",
    "ack_and_close",
    "spam_or_invalid",
  ]),
  resolution_note: z.string().max(8000).optional(),
  linked_module_id: z.string().uuid().optional().nullable(),
  linked_task_id: z
    .string()
    .regex(/^TASK-\d+$/i)
    .optional()
    .nullable(),
  /** TASK-039: Care Specialist bucket label for training corpus. */
  safety_relabel: safetyRelabelEnum.optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireInternalAdminApi();
  if (!auth.ok) {
    return auth.response;
  }
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = triageBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [prev] = await db.select().from(userFeedback).where(eq(userFeedback.id, id)).limit(1);
  if (!prev) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (b.linked_module_id) {
    const [m] = await db.select({ id: modules.id }).from(modules).where(eq(modules.id, b.linked_module_id)).limit(1);
    if (!m) {
      return NextResponse.json({ error: "module_not_found" }, { status: 400 });
    }
  }

  const now = new Date();
  await db
    .update(userFeedback)
    .set({
      triageState: b.state,
      resolutionNote: b.resolution_note !== undefined ? b.resolution_note : prev.resolutionNote,
      linkedModuleId: b.linked_module_id !== undefined ? b.linked_module_id : prev.linkedModuleId,
      linkedTaskId: b.linked_task_id !== undefined ? b.linked_task_id : prev.linkedTaskId,
      ...(b.safety_relabel !== undefined ? { safetyRelabel: b.safety_relabel } : {}),
      triagedBy: auth.userId,
      triagedAt: now,
    })
    .where(eq(userFeedback.id, id));

  await db.insert(adminAudit).values({
    userId: auth.userId,
    path: `/api/internal/feedback/${id}/triage`,
    meta: {
      action: "triage",
      feedbackId: id,
      from: prev.triageState,
      to: b.state,
      linkedModuleId: b.linked_module_id ?? null,
      linkedTaskId: b.linked_task_id ?? null,
    },
  });

  if (b.linked_module_id && b.linked_module_id !== prev.linkedModuleId) {
    const [mod] = await db
      .select({ slug: modules.slug, title: modules.title })
      .from(modules)
      .where(eq(modules.id, b.linked_module_id))
      .limit(1);
    if (mod) {
      await postSlackFeedbackMessage(
        `Module linked: “${mod.title}” (${mod.slug}) — open ${baseUrl()}/internal/feedback (feedback id: ${id})`,
      );
      await db.insert(adminAudit).values({
        userId: auth.userId,
        path: `/api/internal/feedback/${id}/module_link`,
        meta: { feedbackId: id, moduleId: b.linked_module_id, slug: mod.slug, linkOnly: true },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
