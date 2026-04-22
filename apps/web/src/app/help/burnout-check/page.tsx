import { requireSession } from "@/lib/auth/session";
import { BurnoutQuestionnaire } from "@/components/help/BurnoutQuestionnaire";
import { ScreenHeader } from "@/components/screen-header";

export default async function BurnoutCheckPage() {
  await requireSession();
  return (
    <>
      <ScreenHeader
        subHeadline="All answers stay on this device until you submit — we don’t keep your score over time in v0."
        title="Caregiver burnout self-check"
      />
      <BurnoutQuestionnaire />
    </>
  );
}
