export function PlaceholderCard({ ticket }: Readonly<{ ticket: string }>) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-muted-foreground">
      This screen ships in {ticket}.
    </div>
  );
}
