export default function LibraryLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading library">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-10 w-full max-w-md animate-pulse rounded bg-muted" />
      <div className="flex gap-2">
        <div className="h-9 w-16 animate-pulse rounded-full bg-muted" />
        <div className="h-9 w-20 animate-pulse rounded-full bg-muted" />
        <div className="h-9 w-14 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="space-y-4 border-t border-border pt-6">
        <div className="h-6 w-64 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
