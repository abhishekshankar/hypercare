import { ScreenHeader } from "@/components/screen-header";

/**
 * v0 placeholder — full “About” content ships later. Linked from Help footer (TASK-021).
 */
export default function AboutPage() {
  return (
    <>
      <ScreenHeader
        subHeadline="We’ll tell the full product story here soon."
        title="About Hypercare"
      />
      <p className="text-base leading-relaxed text-muted-foreground">Coming soon.</p>
    </>
  );
}
