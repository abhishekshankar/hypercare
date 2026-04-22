import "server-only";
import { createDbClient, users } from "@hypercare/db";

import { serverEnv } from "../env.server";
import type { IdTokenClaims } from "./jwks";

type AppDb = ReturnType<typeof createDbClient>;

export function emailFromClaims(claims: IdTokenClaims): string {
  if (typeof claims.email === "string" && claims.email.length > 0) {
    return claims.email;
  }
  return `${claims.sub}@users.invalid`;
}

/**
 * Create or update the user row for Cognito `sub` from verified ID token claims.
 */
export async function upsertUserFromClaims(
  claims: IdTokenClaims,
  db: AppDb = createDbClient(serverEnv.DATABASE_URL),
): Promise<{ id: string; cognitoSub: string; email: string }> {
  const cognitoSub = claims.sub;
  const email = emailFromClaims(claims);

  const [row] = await db
    .insert(users)
    .values({ cognitoSub, email, displayName: null })
    .onConflictDoUpdate({
      target: users.cognitoSub,
      set: { email, updatedAt: new Date() },
    })
    .returning({ id: users.id, cognitoSub: users.cognitoSub, email: users.email });

  if (row == null) {
    throw new Error("upsert_user: no row returned");
  }
  return {
    id: row.id,
    cognitoSub: row.cognitoSub,
    email: row.email,
  };
}
