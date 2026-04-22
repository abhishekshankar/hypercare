import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { isE2ETestRuntime } from "@/lib/env.test-runtime";
import { serverEnv } from "@/lib/env.server";
import { createDbClient, safetyFlags, users } from "@hypercare/db";

export const dynamic = "force-dynamic";

const E2E_COGNITO_SUB = "e2e-onboarding-playwright";

/**
 * E2E-only: return recent `safety_flags` rows for the fixed Playwright user
 * (TASK-021 verifies burnout soft-flag insert).
 */
export async function GET(request: NextRequest) {
  if (!isE2ETestRuntime()) {
    return new NextResponse("Not found", { status: 404 });
  }
  const expected = process.env.E2E_SETUP_SECRET;
  if (expected == null || expected.length === 0) {
    return new NextResponse("Misconfigured", { status: 500 });
  }
  const secret = request.headers.get("x-e2e-secret");
  if (secret !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(20, Math.max(1, limitParam == null ? 10 : Number.parseInt(limitParam, 10) || 10));

  const db = createDbClient(serverEnv.DATABASE_URL);
  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.cognitoSub, E2E_COGNITO_SUB))
    .limit(1);
  if (userRow == null) {
    return NextResponse.json({ flags: [] });
  }

  const flags = await db
    .select({
      category: safetyFlags.category,
      severity: safetyFlags.severity,
      source: safetyFlags.source,
    })
    .from(safetyFlags)
    .where(eq(safetyFlags.userId, userRow.id))
    .orderBy(desc(safetyFlags.createdAt))
    .limit(limit);

  return NextResponse.json({ flags });
}
