export function ScreenHeader({
  title,
  subHeadline,
}: Readonly<{
  title: string;
  subHeadline?: string;
}>) {
  return (
    <header className="mb-8">
      <h1 className="font-serif text-3xl font-normal leading-tight tracking-tight text-foreground">
        {title}
      </h1>
      {subHeadline ? (
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{subHeadline}</p>
      ) : null}
    </header>
  );
}
