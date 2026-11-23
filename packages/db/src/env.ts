import { z } from "zod";

/** Validates a Postgres connection URL (used by Drizzle Kit and the migrate runner). */
export const databaseUrlSchema = z
  .string()
  .min(1, "DATABASE_URL is required")
  .refine(
    (u) => u.startsWith("postgres://") || u.startsWith("postgresql://"),
    "DATABASE_URL must start with postgres:// or postgresql://",
  );

export function requireDatabaseUrl(): string {
  const parsed = databaseUrlSchema.safeParse(process.env.DATABASE_URL);
  if (!parsed.success) {
    console.error("Invalid DATABASE_URL:", parsed.error.flatten().formErrors.join("; "));
    process.exit(1);
  }
  return parsed.data;
}

export function assertDatabaseUrl(url: string): string {
  return databaseUrlSchema.parse(url);
}
