import { eq } from "drizzle-orm";
import { createDbClient, privacyExportRequests } from "@hypercare/db";
import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { logAdminAudit } from "@/lib/internal/visit-log";
import { presignExportDownload, uploadExportZip } from "@/lib/privacy/s3-put";
import { buildExportZipBuffer } from "@/lib/privacy/zip-export";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (session == null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const exportId = request.nextUrl.searchParams.get("exportId");
  if (exportId == null || exportId.length === 0) {
    return NextResponse.json({ error: "missing_export_id" }, { status: 400 });
  }
  if (serverEnv.PRIVACY_EXPORT_S3_BUCKET == null) {
    return NextResponse.json({ error: "export_unavailable" }, { status: 503 });
  }
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [row] = await db
    .select()
    .from(privacyExportRequests)
    .where(eq(privacyExportRequests.id, exportId))
    .limit(1);
  if (row == null || row.userId !== session.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (row.status === "complete" && row.s3Key != null) {
    const downloadUrl = await presignExportDownload(row.s3Key);
    return NextResponse.json({ status: "complete", downloadUrl });
  }
  if (row.status === "error") {
    return NextResponse.json({ status: "error", error: row.error ?? "unknown" });
  }

  try {
    const buf = await buildExportZipBuffer(db, session.userId);
    const key = `exports/${session.userId}/${exportId}/export.zip`;
    await uploadExportZip(key, buf);
    await db
      .update(privacyExportRequests)
      .set({
        status: "complete",
        completedAt: new Date(),
        s3Key: key,
      })
      .where(eq(privacyExportRequests.id, exportId));
    await logAdminAudit(session.userId, "/api/app/privacy/export");
    const downloadUrl = await presignExportDownload(key);
    return NextResponse.json({ status: "complete", downloadUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "export_failed";
    await db
      .update(privacyExportRequests)
      .set({
        status: "error",
        completedAt: new Date(),
        error: msg,
      })
      .where(eq(privacyExportRequests.id, exportId));
    return NextResponse.json({ status: "error", error: msg });
  }
}
