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
   * `test` is set by Vitest so optional secrets can be minimal in unit tests; production uses `development` or `production`.
   */
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
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
  NODE_ENV: process.env.NODE_ENV as "development" | "test" | "production" | undefined,
};

const parsed = serverSchema.safeParse(raw);
if (!parsed.success) {
  const msg = `Invalid or missing environment variables (server boot):\n${formatZodError(parsed.error)}`;
  throw new Error(msg);
}

export const serverEnv = parsed.data;
export type ServerEnv = z.infer<typeof serverSchema>;

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

export function isProductionCookieSecure(): boolean {
  if (serverEnv.NODE_ENV === "test") {
    return false;
  }
  if (serverEnv.NODE_ENV === "development") {
    return false;
  }
  return true;
}
