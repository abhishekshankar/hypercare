"use client";

export default function LibraryError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Library unavailable</h1>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <button
        className="text-sm font-medium text-accent underline-offset-4 hover:underline"
        type="button"
        onClick={() => {
          reset();
        }}
      >
        Try again
      </button>
    </div>
  );
}
