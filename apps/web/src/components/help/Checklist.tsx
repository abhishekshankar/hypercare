type ChecklistProps = Readonly<{
  title: string;
  items: readonly string[];
  testId: string;
}>;

export function Checklist({ title, items, testId }: ChecklistProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4" data-testid={testId}>
      <h3 className="font-serif text-lg font-normal text-foreground">{title}</h3>
      <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-relaxed text-foreground/90" role="list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
