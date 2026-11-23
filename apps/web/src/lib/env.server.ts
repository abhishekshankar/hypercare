import "server-only";
import { z } from "zod";

const urlString = z.string().min(1);
const minSecretBytes = (n: number) =>
  z
    .string()
    .refine(
      (s) => new TextEncoder().encode(s).length >= n,
      `Must be at least ${n} bytes when encoded as UTF-8`,
    );

const serverSchema = z.object({
  COGNITO_USER_POOL_ID: z.string().min(1),
  COGNITO_APP_CLIENT_ID: z.string().min(1),
  COGNITO_APP_CLIENT_SECRET: minSecretBytes(1),
  COGNITO_DOMAIN: urlString.refine((s) => s.startsWith("https://") || s.startsWith("http://"), {
    message: "COGNITO_DOMAIN must be a full URL",
  }),
  COGNITO_REGION: z.string().min(1),
  AUTH_BASE_URL: urlString.refine((s) => s.startsWith("https://") || s.startsWith("http://"), {
    message: "AUTH_BASE_URL must be a full URL (no path-only value)",
  }),
  /**
   * Exact Cognito-allowed sign-out URL for this environment (local / Amplify / prod root).
   * May differ from AUTH_BASE_URL when the app lives under a path (e.g. prod base is cogcare.org/care1, sign-out is cogcare.org).
   */
  AUTH_SIGNOUT_URL: urlString.refine((s) => s.startsWith("https://") || s.startsWith("http://"), {
    message: "AUTH_SIGNOUT_URL must be a full URL",
  }),
  SESSION_COOKIE_SECRET: minSecretBytes(32),
  DATABASE_URL: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string()
      .min(1)
      .refine((s) => /^postgres(ql)?:\/\//i.test(s), {
        message:
          "DATABASE_URL must be a postgres connection string (e.g. postgres://user:pass@host:5432/db)",
      }),
  ),
  /**
   * Optional superuser / migration URL for content publish (embeddings + chunk write).
   * When unset, publish uses `DATABASE_URL` (same as the app role).
   */
  DATABASE_URL_ADMIN: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
    z
      .string()
      .refine((s) => /^postgres(ql)?:\/\//i.test(s), { message: "Invalid postgres URL" })
      .optional(),
  ),
  /**
   * `test` is set by Vitest so optional secrets can be minimal in unit tests; production uses `development` or `production`.
   */
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  /**
   * Comma-separated. Grants `/internal/*` (metrics) before `users.role` is set in DB.
   * Production should rely on `users.role = 'admin'`.
   */
  INTERNAL_METRICS_ALLOW_EMAILS: z.string().optional(),
  /** Incoming webhook for #hc-feedback-queue (TASK-036); optional in dev/test. */
  SLACK_FEEDBACK_WEBHOOK_URL: z
    .preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.string().url().optional()),
  /** Protects `/api/cron/feedback-sla` (EventBridge or manual). */
  CRON_SECRET: z
    .preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.string().min(16).optional()),
  /**
   * Self-serve data export (TASK-032). When unset, `POST /api/app/privacy/export` returns 503 in production.
   * Tests may leave unset; unit tests mock S3.
   */
  PRIVACY_EXPORT_S3_BUCKET: z
    .preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.string().min(1).optional()),
  /** AWS region for the export bucket. */
  AWS_REGION: z
    .preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.string().min(1).optional()),
  /** TASK-031: pair with NEXT_PUBLIC_STREAMING_ANSWERS; optional. */
  STREAMING_ANSWERS: z
    .preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.string().optional()),
  /** TASK-040: pair with NEXT_PUBLIC_STREAMING_LESSONS. */
  STREAMING_LESSONS: z
    .preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.string().optional()),
  /** TASK-041: pair with NEXT_PUBLIC_STREAMING_LIBRARY. */
  STREAMING_LIBRARY: z
    .preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.string().optional()),
  /** TASK-042: per-user model routing experiment (Layer 5). */
  MODEL_ROUTING: z
    .preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.string().optional()),
});

function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((i) => {
      const path = i.path.length > 0 ? `${i.path.join(".")}: ` : "";
      return `${path}${i.message}`;
    })
    .join("\n");
}

/**
 * When `next build` prerenders/collects route modules, no real env is available yet.
 * These inert values exist only to satisfy `zod` during `phase-production-build`; runtime always uses
 * real variables from the host (Amplify, etc.).
 */
const NEXT_BUILD_PLACEHOLDERS = {
  COGNITO_USER_POOL_ID: "ca-central-1_BUILD_PLACEHOLDER",
  COGNITO_APP_CLIENT_ID: "buildplaceholdersidbuildpl",
  COGNITO_APP_CLIENT_SECRET: "build-cognito-client-secret-min-32b-long-str",
  COGNITO_DOMAIN: "https://build-placeholder.local.example",
  COGNITO_REGION: "ca-central-1",
  AUTH_BASE_URL: "http://127.0.0.1:1",
  AUTH_SIGNOUT_URL: "http://127.0.0.1:1",
  SESSION_COOKIE_SECRET: "0123456789abcdef0123456789abcdef",
  DATABASE_URL: "postgres://b:b@127.0.0.1:1/b",
  INTERNAL_METRICS_ALLOW_EMAILS: undefined,
  SLACK_FEEDBACK_WEBHOOK_URL: undefined,
  CRON_SECRET: undefined,
  PRIVACY_EXPORT_S3_BUCKET: undefined,
  AWS_REGION: "ca-central-1",
  STREAMING_ANSWERS: undefined,
  STREAMING_LESSONS: undefined,
  STREAMING_LIBRARY: undefined,
  MODEL_ROUTING: undefined,
} as const;

const isNextProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

const raw = {
  COGNITO_USER_POOL_ID: (isNextProductionBuild
    ? (process.env.COGNITO_USER_POOL_ID ?? NEXT_BUILD_PLACEHOLDERS.COGNITO_USER_POOL_ID)
    : process.env.COGNITO_USER_POOL_ID) as string | undefined,
  COGNITO_APP_CLIENT_ID: (isNextProductionBuild
    ? (process.env.COGNITO_APP_CLIENT_ID ?? NEXT_BUILD_PLACEHOLDERS.COGNITO_APP_CLIENT_ID)
    : process.env.COGNITO_APP_CLIENT_ID) as string | undefined,
  COGNITO_APP_CLIENT_SECRET: (isNextProductionBuild
    ? (process.env.COGNITO_APP_CLIENT_SECRET ?? NEXT_BUILD_PLACEHOLDERS.COGNITO_APP_CLIENT_SECRET)
    : process.env.COGNITO_APP_CLIENT_SECRET) as string | undefined,
  COGNITO_DOMAIN: (isNextProductionBuild
    ? (process.env.COGNITO_DOMAIN ?? NEXT_BUILD_PLACEHOLDERS.COGNITO_DOMAIN)
    : process.env.COGNITO_DOMAIN) as string | undefined,
  COGNITO_REGION: (isNextProductionBuild
    ? (process.env.COGNITO_REGION ?? NEXT_BUILD_PLACEHOLDERS.COGNITO_REGION)
    : process.env.COGNITO_REGION) as string | undefined,
  AUTH_BASE_URL: (isNextProductionBuild
    ? (process.env.AUTH_BASE_URL ?? NEXT_BUILD_PLACEHOLDERS.AUTH_BASE_URL)
    : process.env.AUTH_BASE_URL) as string | undefined,
  AUTH_SIGNOUT_URL: (isNextProductionBuild
    ? (process.env.AUTH_SIGNOUT_URL ?? NEXT_BUILD_PLACEHOLDERS.AUTH_SIGNOUT_URL)
    : process.env.AUTH_SIGNOUT_URL) as string | undefined,
  SESSION_COOKIE_SECRET: (isNextProductionBuild
    ? (process.env.SESSION_COOKIE_SECRET ?? NEXT_BUILD_PLACEHOLDERS.SESSION_COOKIE_SECRET)
    : process.env.SESSION_COOKIE_SECRET) as string | undefined,
  DATABASE_URL: (isNextProductionBuild
    ? (process.env.DATABASE_URL ?? NEXT_BUILD_PLACEHOLDERS.DATABASE_URL)
    : process.env.DATABASE_URL) as string | undefined,
  DATABASE_URL_ADMIN: process.env.DATABASE_URL_ADMIN,
  NODE_ENV: process.env.NODE_ENV as "development" | "test" | "production" | undefined,
  INTERNAL_METRICS_ALLOW_EMAILS: process.env.INTERNAL_METRICS_ALLOW_EMAILS as string | undefined,
  SLACK_FEEDBACK_WEBHOOK_URL: process.env.SLACK_FEEDBACK_WEBHOOK_URL,
  CRON_SECRET: process.env.CRON_SECRET,
  PRIVACY_EXPORT_S3_BUCKET: process.env.PRIVACY_EXPORT_S3_BUCKET,
  AWS_REGION: process.env.AWS_REGION,
  STREAMING_ANSWERS: process.env.STREAMING_ANSWERS as string | undefined,
  STREAMING_LESSONS: process.env.STREAMING_LESSONS as string | undefined,
  STREAMING_LIBRARY: process.env.STREAMING_LIBRARY as string | undefined,
  MODEL_ROUTING: process.env.MODEL_ROUTING as string | undefined,
};

const parsed = serverSchema.safeParse(raw);
if (!parsed.success) {
  const msg = `Invalid or missing environment variables (server boot):\n${formatZodError(parsed.error)}`;
  throw new Error(msg);
}

export const serverEnv = parsed.data;
export type ServerEnv = z.infer<typeof serverSchema>;

/** DB URL for `publishModuleFromDatabase` (Titan embeddings + chunk writes). */
export function contentPublishDatabaseUrl(): string {
  return serverEnv.DATABASE_URL_ADMIN ?? serverEnv.DATABASE_URL;
}

/** Cognito issuer for ID token validation. */
export function cognitoIssuer(): string {
  return `https://cognito-idp.${serverEnv.COGNITO_REGION}.amazonaws.com/${serverEnv.COGNITO_USER_POOL_ID}`;
}

/** Public JWKS document for the user pool. */
export function cognitoJwksUrl(): string {
  return `https://cognito-idp.${serverEnv.COGNITO_REGION}.amazonaws.com/${serverEnv.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
}

export function callbackUrl(): string {
  return `${baseUrl()}/api/auth/callback`;
}

export function baseUrl(): string {
  return serverEnv.AUTH_BASE_URL.replace(/\/$/, "");
}

/** Server flag for TASK-031 (pair with NEXT_PUBLIC_STREAMING_ANSWERS in the browser). */
export function streamingAnswersEnabled(): boolean {
  const v = serverEnv.STREAMING_ANSWERS;
  return v === "1" || v === "true";
}

/** TASK-040: both server and NEXT_PUBLIC must be on for the lesson streaming path. */
export function streamingLessonsEnabled(): boolean {
  const v = serverEnv.STREAMING_LESSONS;
  return v === "1" || v === "true";
}

/** TASK-041: both server and NEXT_PUBLIC must be on for the library SSE search path. */
export function streamingLibraryEnabled(): boolean {
  const v = serverEnv.STREAMING_LIBRARY;
  return v === "1" || v === "true";
}

/** TASK-042: Layer-5 model routing + `model_routing_decisions` logging. */
export function modelRoutingEnabled(): boolean {
  const v = serverEnv.MODEL_ROUTING;
  return v === "1" || v === "true";
}

export function isProductionCookieSecure(): boolean {
  if (serverEnv.NODE_ENV === "test") {
    return false;
  }
  if (serverEnv.NODE_ENV === "development") {
    return false;
  }
  return true;
}
