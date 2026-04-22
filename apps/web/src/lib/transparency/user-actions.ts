import { createDbClient, userActions } from "@hypercare/db";

export const TRANSPARENCY_FORGET_ACTION = "transparency_forget";
export const TRANSPARENCY_REFRESH_ACTION = "transparency_refresh";
export const TRANSPARENCY_CLEAR_ACTION = "transparency_clear";

export async function logTransparencyUserAction(
  databaseUrl: string,
  args: { userId: string; action: string; path: string; meta?: Record<string, unknown> },
): Promise<void> {
  const db = createDbClient(databaseUrl);
  await db.insert(userActions).values({
    userId: args.userId,
    action: args.action,
    path: args.path,
    meta: args.meta ?? null,
  });
}
