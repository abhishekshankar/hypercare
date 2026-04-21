import { PlaceholderCard } from "@/components/placeholder-card";
import { ScreenHeader } from "@/components/screen-header";

export default function AppHomePage() {
  return (
    <>
      <ScreenHeader
        subHeadline="Ask anything about daily care — grounded in reviewed sources. No feed, no streaks."
        title="Home"
      />
      <PlaceholderCard ticket="TASK-011" />
    </>
  );
}
