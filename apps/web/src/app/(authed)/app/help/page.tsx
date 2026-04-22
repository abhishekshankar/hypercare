import { HelpFeedbackForm } from "./HelpFeedbackForm";

export default function AppHelpPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-foreground">Help &amp; feedback</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us what&apos;s not working. We read every submission during the beta.
        </p>
      </div>
      <HelpFeedbackForm />
      <p className="text-xs leading-relaxed text-muted-foreground">
        If you&apos;re in a crisis or worried about your person&apos;s immediate safety, this form isn&apos;t the
        fastest way — we show crisis resources in any conversation, or you can reach them directly:{" "}
        <a className="text-accent underline-offset-2 hover:underline" href="tel:988">
          988
        </a>{" "}
        (US) /{" "}
        <a className="text-accent underline-offset-2 hover:underline" href="tel:911">
          911
        </a>{" "}
        for emergencies. (Copy reviewed with Care Specialist before production deploy.)
      </p>
    </div>
  );
}
