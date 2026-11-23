import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-[70rem] flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-12 md:py-5">
        <Link
          aria-label="Alongside home"
          className="font-serif text-xl font-medium tracking-tight text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent md:text-[26px]"
          href="/"
        >
          Along<em className="not-italic text-accent">side</em>
        </Link>
        <nav aria-label="Primary" className="flex flex-wrap items-center gap-6 md:gap-8">
          <Link
            className="text-sm text-foreground-muted no-underline transition-colors hover:text-foreground hover:underline"
            href="/help"
          >
            Help
          </Link>
        </nav>
      </div>
    </header>
  );
}
