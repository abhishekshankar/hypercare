import { z } from "zod";

/**
 * Public env subset (browser-safe). Expand with NEXT_PUBLIC_* as needed; never import server secrets.
 */
const clientSchema = z.object({});

const parsed = clientSchema.safeParse({});

export const clientEnv = parsed.success ? parsed.data : clientSchema.parse({});
