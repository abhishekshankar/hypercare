import {
  hasAnyRole,
  parseHeavyPublishBundle,
  publishHeavyModulePayload,
  type AppRole,
} from "@alongside/content";
import { NextResponse } from "next/server";
import { contentPublishDatabaseUrl } from "@/lib/env.server";
import { requireInternalContentUser } from "@/lib/internal/content-access";
import { monorepoRootFromCwd } from "@/lib/monorepo-root";

const PUBLISH_ROLES: AppRole[] = ["content_writer", "content_lead", "admin"];

export async function POST(request: Request) {
  const auth = await requireInternalContentUser();
  if (!auth.ok) {
    return auth.response;
  }
  if (!hasAnyRole(auth.user.role as AppRole, PUBLISH_ROLES)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  let parsed;
  try {
    parsed = parseHeavyPublishBundle(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid bundle";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  try {
    const res = await publishHeavyModulePayload(parsed, {
      repoRoot: monorepoRootFromCwd(),
      databaseUrl: contentPublishDatabaseUrl(),
      seedRelationTargets: false,
    });
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "publish failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
