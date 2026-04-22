import "server-only";

import { serverEnv } from "@/lib/env.server";

export async function postSlackFeedbackMessage(text: string): Promise<void> {
  const url = serverEnv.SLACK_FEEDBACK_WEBHOOK_URL;
  if (!url) {
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.warn("slack.webhook_failed", { status: res.status });
    }
  } catch (e) {
    console.warn("slack.webhook_error", { error: e instanceof Error ? e.message : String(e) });
  }
}
