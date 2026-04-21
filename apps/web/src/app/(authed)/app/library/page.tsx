import { PlaceholderCard } from "@/components/placeholder-card";
import { ScreenHeader } from "@/components/screen-header";

export default function LibraryPage() {
  return (
    <>
      <ScreenHeader
        subHeadline="Browse modules by situation — behaviors, care, legal, self-care, and more."
        title="The library"
      />
      <PlaceholderCard ticket="sprint 2" />
    </>
  );
}
