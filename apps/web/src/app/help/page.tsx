import { ScreenHeader } from "@/components/screen-header";

export default function HelpPage() {
  return (
    <>
      <ScreenHeader
        subHeadline="Safety resources and how to reach a person when you need one."
        title="Help & safety"
      />
      <div className="space-y-8 text-foreground">
        <section className="space-y-2">
          <h2 className="font-serif text-xl font-normal text-foreground">Crisis &amp; helplines</h2>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>
              Alzheimer&apos;s Association 24/7 helpline:{" "}
              <a className="text-accent underline underline-offset-2" href="tel:8002723900">
                800-272-3900
              </a>
            </li>
            <li>
              988 Suicide &amp; Crisis Lifeline (call or text):{" "}
              <a className="text-accent underline underline-offset-2" href="tel:988">
                988
              </a>
            </li>
            <li>
              Crisis Text Line — text{" "}
              <span className="font-medium text-foreground">HOME</span> to{" "}
              <span className="font-medium text-foreground">741741</span>
            </li>
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="font-serif text-xl font-normal text-foreground">
            Adult Protective Services
          </h2>
          <p className="text-muted-foreground">
            <a
              className="text-accent underline underline-offset-2"
              href="https://eldercare.acl.gov/Public/Index.aspx"
              rel="noopener noreferrer"
              target="_blank"
            >
              Find your local APS / elder abuse reporting contact (ACL Eldercare Locator)
            </a>
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-serif text-xl font-normal text-foreground">When to call the doctor</h2>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>Sudden confusion, much worse than their usual, or new weakness on one side</li>
            <li>Fever, signs of infection, or pain you can&apos;t soothe</li>
            <li>New medicines or dose changes and behavior or alertness suddenly changes</li>
            <li>Falls with head injury, or any fall with new confusion or vomiting</li>
            <li>Not drinking or eating, or dehydration signs (very dry mouth, no urine for 12+ hours)</li>
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="font-serif text-xl font-normal text-foreground">When to call 911</h2>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>Thoughts of self-harm or suicide, or says they want to die</li>
            <li>Threatening or violent behavior you cannot safely redirect</li>
            <li>Chest pain, trouble breathing, or unconscious / won&apos;t wake up</li>
            <li>Signs of stroke: face drooping, arm weakness, slurred speech — sudden onset</li>
            <li>Severe bleeding, choking, or any situation that feels immediately life-threatening</li>
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="font-serif text-xl font-normal text-foreground">
            Caregiver burnout self-assessment
          </h2>
          <p className="text-muted-foreground">
            Guided self-check (link placeholder — full flow ships in a later sprint):{" "}
            <span className="text-foreground">#burnout-assessment</span>
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-serif text-xl font-normal text-foreground">Product support</h2>
          <p className="text-muted-foreground">
            <a className="text-accent underline underline-offset-2" href="mailto:support@hypercare.invalid">
              Email support (placeholder)
            </a>{" "}
            — replace with the real support address before launch.
          </p>
        </section>
      </div>
    </>
  );
}
