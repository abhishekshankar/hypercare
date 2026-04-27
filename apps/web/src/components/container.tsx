export function Container({ children }: Readonly<{ children: React.ReactNode }>) {
  /* Alongside homepage: max-width 1120px, 48px gutters on large screens */
  return <div className="mx-auto w-full max-w-[70rem] px-5 md:px-12">{children}</div>;
}
