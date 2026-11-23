import { FeedbackQueueClient } from "./FeedbackQueueClient";

export const dynamic = "force-dynamic";

export default function InternalFeedbackPage() {
  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Feedback queue</h1>
      <p className="mb-4 text-xs text-zinc-600">In-app submissions + thumbs-down (TASK-036).</p>
      <FeedbackQueueClient />
    </div>
  );
}
