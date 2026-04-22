/**
 * Operator CLI — same delete transaction as the self-serve API (TASK-032).
 *   pnpm --filter @hypercare/db admin:forget -- --user-id=<uuid> --reason="support ticket"
 */
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { createDbClient } from "../client.js";
import { requireDatabaseUrl } from "../env.js";
import { deleteUserAccount } from "../privacy/delete-user.js";
import { careProfile } from "../schema/care-profile.js";
import { users } from "../schema/users.js";

const { values } = parseArgs({
  options: {
    "user-id": { type: "string" },
    reason: { type: "string" },
  },
});
const userId = values["user-id"];
const reason = values.reason;
if (userId == null || userId.length === 0) {
  console.error("Missing --user-id=<uuid>");
  process.exit(1);
}
if (reason == null || reason.length === 0) {
  console.error("Missing --reason=<string>");
  process.exit(1);
}

const url = requireDatabaseUrl();
const db = createDbClient(url);
const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
if (u == null) {
  console.error("user not found");
  process.exit(1);
}
const [p] = await db.select().from(careProfile).where(eq(careProfile.userId, userId)).limit(1);
await deleteUserAccount(db, {
  userId,
  pii: { email: u.email, crFirstName: p?.crFirstName ?? null },
  audit: {
    path: "/admin/cli/forget",
    source: "admin_cli",
    reason,
  },
});
console.log("ok: user deleted and safety_flags de-identified");
process.exit(0);
