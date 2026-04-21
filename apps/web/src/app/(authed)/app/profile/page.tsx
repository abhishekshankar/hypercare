import { PlaceholderCard } from "@/components/placeholder-card";
import { ScreenHeader } from "@/components/screen-header";

export default function ProfilePage() {
  return (
    <>
      <ScreenHeader
        subHeadline="What the product knows about your person and your situation — editable in sprint 2."
        title="Care profile"
      />
      <PlaceholderCard ticket="TASK-007 (read-only); sprint 2 (editing)" />
    </>
  );
}
