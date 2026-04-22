import { z } from "zod";

/**
 * Public env subset (browser-safe). Expand with NEXT_PUBLIC_* as needed; never import server secrets.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_STREAMING_ANSWERS: z.string().optional(),
  NEXT_PUBLIC_STREAMING_LESSONS: z.string().optional(),
  NEXT_PUBLIC_STREAMING_LIBRARY: z.string().optional(),
});

const parsed = clientSchema.safeParse({
  NEXT_PUBLIC_STREAMING_ANSWERS: process.env.NEXT_PUBLIC_STREAMING_ANSWERS,
  NEXT_PUBLIC_STREAMING_LESSONS: process.env.NEXT_PUBLIC_STREAMING_LESSONS,
  NEXT_PUBLIC_STREAMING_LIBRARY: process.env.NEXT_PUBLIC_STREAMING_LIBRARY,
});

export const clientEnv = parsed.success ? parsed.data : clientSchema.parse({});

/** TASK-041: pair with STREAMING_LIBRARY on the server. */
export function streamingLibraryClientEnabled(): boolean {
  const v = clientEnv.NEXT_PUBLIC_STREAMING_LIBRARY;
  return v === "1" || v === "true";
}
