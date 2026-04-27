import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { applySessionToResponse } from "@/lib/auth/session";
import { isE2ETestRuntime } from "@/lib/env.test-runtime";
import {
  ONBOARDING_ACK_COOKIE,
  clearOnboardingAckOnResponse,
} from "@/lib/onboarding/ack";
import { isProductionCookieSecure } from "@/lib/env.server";
import { serverEnv } from "@/lib/env.server";
import { mapStageAnswersV0ToV1, type StageAnswersRecord } from "@alongside/content/stage-rules";
import {
  careProfile,
  careProfileChanges,
  careProfileMembers,
  conversations,
  createDbClient,
  lessonProgress,
  messages,
  modules,
  safetyFlags,
  userActions,
  userSuppression,
  users,
  weeklyCheckins,
} from "@alongside/db";

export const dynamic = "force-dynamic";

const E2E_COGNITO_SUB = "e2e-onboarding-playwright";
const E2E_EMAIL = "e2e-wizard@example.test";

/**
 * Mint a signed session for Playwright (NODE_ENV=test + E2E_SETUP_SECRET).
 * Resets onboarding for a stable test user so the wizard can run end-to-end.
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

  const db = createDbClient(serverEnv.DATABASE_URL);
  const [userRow] = await db
    .insert(users)
    .values({
      cognitoSub: E2E_COGNITO_SUB,
      email: E2E_EMAIL,
      displayName: null,
    })
    .onConflictDoUpdate({
      target: users.cognitoSub,
      set: { email: E2E_EMAIL, displayName: null, updatedAt: new Date() },
    })
    .returning({ id: users.id, cognitoSub: users.cognitoSub, email: users.email });

  if (userRow == null) {
    return new NextResponse("User upsert failed", { status: 500 });
  }

  const routing = request.nextUrl.searchParams.get("routing");
  if (routing === "treatment" || routing === "control") {
    await db
      .update(users)
      .set({
        routingCohort: routing === "treatment" ? "routing_v1_treatment" : "routing_v1_control",
      })
      .where(eq(users.id, userRow.id));
  }

  // `mode=onboarded` seeds a fully-onboarded user (TASK-011 conversation
  // E2E spec) — avoids re-walking the wizard for every conversation test.
  // Default mode resets the user for the onboarding wizard E2E.
  const mode = request.nextUrl.searchParams.get("mode") ?? "fresh";
  const onboarded = mode === "onboarded";

  await db.delete(safetyFlags).where(eq(safetyFlags.userId, userRow.id));
  await db.delete(userActions).where(eq(userActions.userId, userRow.id));
  await db.delete(userSuppression).where(eq(userSuppression.userId, userRow.id));
  await db.delete(lessonProgress).where(eq(lessonProgress.userId, userRow.id));
  await db.delete(weeklyCheckins).where(eq(weeklyCheckins.userId, userRow.id));
  // Always clear conversation history so each test starts from an empty
  // /app surface. Cascade fk drops messages with the conversation row.
  await db.delete(conversations).where(eq(conversations.userId, userRow.id));
  // For paranoia in case fk cascade is ever loosened:
  await db
    .delete(messages)
    .where(eq(messages.conversationId, "00000000-0000-0000-0000-000000000000"));

  await db.delete(careProfileChanges).where(eq(careProfileChanges.userId, userRow.id));
  await db.delete(careProfileMembers).where(eq(careProfileMembers.userId, userRow.id));
  await db.delete(careProfile).where(eq(careProfile.userId, userRow.id));

  if (onboarded) {
    await db
      .update(users)
      .set({ displayName: "Alex" })
      .where(eq(users.id, userRow.id));
    const inferred = request.nextUrl.searchParams.get("inferred");
    const useEarly = inferred === "early";
    const stageAnswers = useEarly
      ? {
          manages_meds: "yes",
          drives: "yes",
          left_alone: "yes",
          recognizes_you: "yes",
          bathes_alone: "yes",
          wandering_incidents: "no",
          conversations: "yes",
          sleeps_through_night: "yes",
        }
      : {
          manages_meds: "yes",
          drives: "no",
          left_alone: "no",
          recognizes_you: "yes",
          bathes_alone: "no",
          wandering_incidents: "no",
          conversations: "yes",
          sleeps_through_night: "no",
        };
    const hardest =
      request.nextUrl.searchParams.get("hardest") ?? "Sundowning most evenings.";
    const v1 = mapStageAnswersV0ToV1(stageAnswers as StageAnswersRecord);
    await db.insert(careProfile).values({
      userId: userRow.id,
      crFirstName: "Margaret",
      crAge: 78,
      crRelationship: "parent",
      crDiagnosis: "alzheimers",
      crDiagnosisYear: 2020,
      stageQuestionsVersion: 1,
      stageAnswers: {},
      medManagementV1: v1.medManagementV1,
      drivingV1: v1.drivingV1,
      aloneSafetyV1: v1.aloneSafetyV1,
      recognitionV1: v1.recognitionV1,
      bathingDressingV1: v1.bathingDressingV1,
      wanderingV1: v1.wanderingV1,
      conversationV1: v1.conversationV1,
      sleepV1: v1.sleepV1,
      inferredStage: useEarly ? "early" : "middle",
      livingSituation: "with_caregiver",
      careNetwork: "solo",
      caregiverProximity: "same_home",
      caregiverAgeBracket: "55_64",
      caregiverWorkStatus: "working",
      caregiverState1_5: 1,
      hardestThing: hardest,
      crBackground: "",
      crJoy: "",
      crPersonalityNotes: "",
    });

    // Optional seed: complete a module N days ago (TASK-024 anti-repeat / cadence E2E).
    const completedSlug = request.nextUrl.searchParams.get("completed_slug");
    const completedDaysAgo = Number.parseInt(
      request.nextUrl.searchParams.get("completed_days_ago") ?? "",
      10,
    );
    if (completedSlug != null && Number.isFinite(completedDaysAgo)) {
      const [m] = await db.select({ id: modules.id }).from(modules).where(eq(modules.slug, completedSlug)).limit(1);
      if (m) {
        const at = new Date(Date.now() - completedDaysAgo * 24 * 60 * 60 * 1000);
        await db.insert(lessonProgress).values({
          userId: userRow.id,
          moduleId: m.id,
          startedAt: at,
          completedAt: at,
          revisit: false,
          source: "weekly_focus",
        });
      }
    }

    // Optional seed: backdate a weekly_checkins row (cadence + elevation E2E).
    const checkinDaysAgo = Number.parseInt(
      request.nextUrl.searchParams.get("checkin_days_ago") ?? "",
      10,
    );
    if (Number.isFinite(checkinDaysAgo)) {
      const at = new Date(Date.now() - checkinDaysAgo * 24 * 60 * 60 * 1000);
      await db.insert(weeklyCheckins).values({
        userId: userRow.id,
        promptedAt: at,
        answeredAt: at,
        triedSomething: true,
        whatHelped: null,
      });
    }

    // Optional seed: insert N soft burnout flags within the last 7d (elevation E2E).
    const softFlags = Number.parseInt(
      request.nextUrl.searchParams.get("soft_flags") ?? "",
      10,
    );
    if (Number.isFinite(softFlags) && softFlags > 0) {
      for (let i = 0; i < softFlags; i++) {
        await db.insert(safetyFlags).values({
          userId: userRow.id,
          messageText: "Burnout self-assessment seeded for E2E (TASK-024).",
          category: "self_care_burnout",
          severity: "low",
          source: "burnout_self_assessment",
          matchedSignals: ["seed:e2e", `idx:${String(i)}`],
        });
      }
    }
  }

  const next = request.nextUrl.searchParams.get("next") ?? "/onboarding/step/1";
  // Build the redirect URL from the incoming `Host` header so Playwright's
  // `page` (which connects on 127.0.0.1:3456) keeps the same origin and the
  // cookies we set below are sent on the next navigation. Both `request.url`
  // and `request.nextUrl.origin` resolve to "http://localhost:3456" under
  // `next dev` regardless of how the client connected, which would force the
  // browser onto a host where the cookie is not eligible (TASK-013).
  // Trust: Host-derived Location is safe here only because `isE2ETestRuntime()`
  // above returns 404 outside E2E — never expose this pattern to production.
  const hostHeader = request.headers.get("host") ?? request.nextUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(/:$/, "");
  const redirectBase = `${proto}://${hostHeader}`;
  const res = NextResponse.redirect(new URL(next, redirectBase).toString());
  if (onboarded) {
    res.cookies.set(ONBOARDING_ACK_COOKIE, "1", {
      httpOnly: true,
      secure: isProductionCookieSecure() ? true : false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    clearOnboardingAckOnResponse(res);
  }
  await applySessionToResponse(res, {
    userId: userRow.id,
    cognitoSub: userRow.cognitoSub,
    email: userRow.email,
  });
  return res;
}
