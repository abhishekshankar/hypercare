import { PlaceholderCard } from "@/components/placeholder-card";
import { ScreenHeader } from "@/components/screen-header";

export default async function ConversationPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return (
    <>
      <ScreenHeader
        subHeadline={`Conversation ${id} (stub) — the answer scaffold ships in TASK-011.`}
        title="Conversation"
      />
      <PlaceholderCard ticket="TASK-011" />
    </>
  );
}
