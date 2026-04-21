export function CrisisStrip() {
  return (
    <aside
      aria-label="Crisis resources"
      className="sticky top-0 z-50 border-b border-border bg-crisis-bg px-4 py-2.5 text-center text-sm text-crisis-fg shadow-sm"
      role="region"
    >
      <p className="mx-auto max-w-3xl leading-snug">
        In crisis right now? Call the Alzheimer&apos;s Association 24/7 helpline:{" "}
        <a
          aria-label="Call the Alzheimer's Association 24/7 helpline"
          className="font-semibold underline decoration-crisis-fg/40 underline-offset-2 outline-none ring-offset-2 ring-offset-crisis-bg focus-visible:ring-2 focus-visible:ring-accent"
          href="tel:8002723900"
        >
          800-272-3900
        </a>
        .
      </p>
    </aside>
  );
}
