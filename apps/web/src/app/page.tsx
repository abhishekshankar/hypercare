import Link from "next/link";

type Props = {
  searchParams: Promise<{ deleted?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const sp = await searchParams;
  const deleted = sp.deleted === "1";
  return (
    <>
      {deleted ? (
        <p
          className="mb-6 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
          role="status"
        >
          Your account has been deleted. If you need support, contact the team.
        </p>
      ) : null}
      <header className="mb-10 md:mb-14">
        <p className="along-eyebrow mb-6">For family caregivers</p>
        <h1 className="max-w-[36rem] font-serif text-4xl font-normal leading-[1.08] tracking-tight text-foreground md:text-6xl md:leading-[1.06]">
          Caregiving for someone with dementia is <em className="text-accent not-italic">relentless.</em> You
          shouldn&apos;t have to figure it out alone.
        </h1>
        <p className="mt-6 max-w-[52ch] font-serif text-lg font-light leading-relaxed text-foreground-muted md:text-[22px] md:leading-[1.5]">
          Guidance tailored to your situation, from trusted sources, whenever you need it.
        </p>
      </header>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
        <Link className="along-primary-cta" href="/onboarding">
          Get started <span aria-hidden="true">→</span>
        </Link>
        <Link className="along-data-link self-start sm:self-center" href="/help">
          How is my data used?
        </Link>
      </div>
      <p className="mt-14 max-w-[48ch] border-t border-border pt-6 text-sm leading-relaxed text-muted-foreground">
        Alongside is free to start. No credit card. You can leave at any time, and take your notes with you.
      </p>
    </>
  );
}
