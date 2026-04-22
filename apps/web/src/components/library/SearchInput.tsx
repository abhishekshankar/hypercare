"use client";

type SearchInputProps = Readonly<{
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}>;

export function SearchInput({ id = "library-search", value, onChange, placeholder }: SearchInputProps) {
  return (
    <div className="w-full max-w-md">
      <label className="sr-only" htmlFor={id}>
        Search modules
      </label>
      <input
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-accent"
        id={id}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search by title, summary, or topic…"}
        type="search"
        value={value}
        autoComplete="off"
        data-testid="library-search-input"
      />
    </div>
  );
}
