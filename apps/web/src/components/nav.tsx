import Link from "next/link";

import { Container } from "@/components/container";

export function Nav() {
  return (
    <header className="border-b border-border bg-background">
      <Container>
        <div className="flex h-12 items-center justify-between">
          <Link
            className="font-serif text-lg font-normal tracking-tight text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-accent"
            href="/"
          >
            Hypercare
          </Link>
          <nav aria-label="Primary">
            <Link
              className="text-sm text-muted-foreground underline-offset-4 outline-none ring-offset-background hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              href="/help"
            >
              Help
            </Link>
          </nav>
        </div>
      </Container>
    </header>
  );
}
