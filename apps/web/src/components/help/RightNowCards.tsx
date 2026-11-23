function PhoneIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.78.6 2.63a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.45-1.17a2 2 0 0 1 2.11-.45c.85.28 1.73.48 2.63.6A2 2 0 0 1 22 16.92z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const cardClass =
  "rounded-lg border border-border bg-card p-4 shadow-sm transition-[box-shadow,transform] hover:shadow-md";

export function RightNowCards() {
  return (
    <div className="space-y-3">
      <a
        className={`${cardClass} block no-underline outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent`}
        data-testid="right-now-helpline-alz"
        href="tel:+18002723900"
        rel="noopener noreferrer"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-accent" aria-hidden>
            <PhoneIcon />
          </span>
          <div>
            <p className="font-serif text-base font-medium text-foreground">Alzheimer&apos;s Association 24/7 Helpline</p>
            <p className="mt-0.5 font-mono text-lg font-medium tracking-tight text-foreground">800-272-3900</p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">Dementia questions, local resources, someone to talk to any time.</p>
          </div>
        </div>
      </a>
      <a
        className={`${cardClass} block no-underline outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent`}
        data-testid="right-now-988"
        href="tel:988"
        rel="noopener noreferrer"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-accent" aria-hidden>
            <PhoneIcon />
          </span>
          <div>
            <p className="font-serif text-base font-medium text-foreground">988 Suicide &amp; Crisis Lifeline</p>
            <p className="mt-0.5 font-mono text-lg font-medium tracking-tight text-foreground">Call or text 988</p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">Free, confidential support 24/7. If you&apos;re in immediate danger, call 911.</p>
          </div>
        </div>
      </a>
      <a
        className={`${cardClass} block no-underline outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent`}
        href="sms:741741&body=HOME"
        rel="noopener noreferrer"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-accent" aria-hidden>
            <PhoneIcon />
          </span>
          <div>
            <p className="font-serif text-base font-medium text-foreground">Crisis Text Line</p>
            <p className="mt-0.5 font-mono text-lg font-medium tracking-tight text-foreground">Text HOME to 741741</p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">Trained crisis counselor by text, 24/7 (US/Canada standard rates may apply).</p>
          </div>
        </div>
      </a>
      <a
        className={`${cardClass} block no-underline outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent`}
        href="https://www.napsa-now.org/get-help/help-in-your-area/"
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-accent" aria-hidden>
            <PhoneIcon />
          </span>
          <div>
            <p className="font-serif text-base font-medium text-foreground">Adult Protective Services</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">Find reporting contact in your state</p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">Use NAPSA’s state-by-state tool when you’re worried about abuse, neglect, or self-neglect.</p>
            <p className="mt-1 text-xs text-muted-foreground">Opens napsa-now.org in a new tab.</p>
          </div>
        </div>
      </a>
    </div>
  );
}
