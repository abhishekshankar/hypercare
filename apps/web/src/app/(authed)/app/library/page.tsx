import { ScreenHeader } from "@/components/screen-header";
import { LibraryBrowse } from "@/components/library/LibraryBrowse";
import { loadLibraryModuleList } from "@/lib/library/load-list";
import type { LibraryModuleListItem } from "@/lib/library/types";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  let modules: LibraryModuleListItem[] = [];
  let loadError: string | null = null;
  try {
    modules = await loadLibraryModuleList();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Unknown error";
    console.error("[library] loadLibraryModuleList failed", e);
  }

  return (
    <>
      <ScreenHeader title="Library." />
      {loadError != null ? (
        <p
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {process.env.NODE_ENV === "development"
            ? `Library could not load from the database (${loadError}). Start the DB tunnel if needed, confirm DATABASE_URL, then refresh.`
            : "Library could not load right now. Please try again in a moment."}
        </p>
      ) : null}
      <LibraryBrowse modules={modules} />
    </>
  );
}
