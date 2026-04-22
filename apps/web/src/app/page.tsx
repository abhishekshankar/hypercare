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
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-normal italic leading-tight tracking-tight text-foreground md:text-4xl">
          Caregiving for someone with dementia is relentless. You shouldn&apos;t have to figure it
          out alone.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Guidance tailored to your situation, from trusted sources, whenever you need it.
        </p>
      </header>
      <p>
        <Link
          className="inline-flex rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          href="/onboarding"
        >
          Get started
        </Link>
      </p>
    </>
  );
}
