import { PlaceholderCard } from "@/components/placeholder-card";
import { ScreenHeader } from "@/components/screen-header";

export default async function LessonPage({
  params,
}: Readonly<{
  params: Promise<{ slug: string }>;
}>) {
  const { slug } = await params;
  return (
    <>
      <ScreenHeader
        subHeadline={`Lesson “${slug}” — five-minute guided content (sprint 2).`}
        title="Daily lesson"
      />
      <PlaceholderCard ticket="sprint 2" />
    </>
  );
}
