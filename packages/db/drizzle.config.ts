import { defineConfig } from "drizzle-kit";
import { databaseUrlSchema } from "./src/env.js";

function kitDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (raw) {
    const parsed = databaseUrlSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("Invalid DATABASE_URL:", parsed.error.flatten().formErrors.join("; "));
      process.exit(1);
    }
    return parsed.data;
  }
  if (process.argv.includes("generate")) {
    return "postgresql://127.0.0.1:5432/__drizzle_generate_placeholder__";
  }
  console.error("DATABASE_URL is required (except for drizzle-kit generate).");
  process.exit(1);
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: kitDatabaseUrl(),
  },
});
