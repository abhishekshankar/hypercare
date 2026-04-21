import { PlaceholderCard } from "@/components/placeholder-card";
import { ScreenHeader } from "@/components/screen-header";

export default function OnboardingPage() {
  return (
    <>
      <ScreenHeader
        subHeadline="A few short steps — you can change any of this later."
        title="Onboarding"
      />
      <PlaceholderCard ticket="TASK-007" />
    </>
  );
}
